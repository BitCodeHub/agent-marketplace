import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * @dev Deployment script for AgentEscrow and AgentRegistry contracts
 * 
 * Deployment order:
 * 1. AgentRegistry - Agent identity and reputation contract
 * 2. AgentEscrow - Main escrow contract (depends on AgentRegistry)
 * 
 * Environment variables:
 * - USDC_ADDRESS: Address of USDC token on target network
 * 
 * Features:
 * - Deploys contracts to specified network
 * - Saves deployment addresses to JSON file
 * - Verifies contracts on Etherscan/Basescan
 * - Sets up initial permissions
 */

const deployContracts: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment
) {
  const { deployments, getNamedAccounts, network, run } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  
  console.log("=====================================");
  console.log("Deploying AI Agent Marketplace Contracts");
  console.log("Network:", network.name);
  console.log("Deployer:", deployer);
  console.log("=====================================");
  
  // USDC addresses by network
  const usdcAddresses: { [key: string]: string } = {
    base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base Mainnet USDC
    baseSepolia: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // Base Sepolia USDC
    sepolia: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // Sepolia USDC
    hardhat: "", // Will deploy mock for local testing
    localhost: "", // Will deploy mock for local testing
  };
  
  // Allow override from environment variable
  let usdcAddress = process.env.USDC_ADDRESS || usdcAddresses[network.name];
  
  // For local testing, deploy a mock USDC token
  if (network.name === "hardhat" || network.name === "localhost") {
    console.log("\n📦 Deploying Mock USDC Token...");
    
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const mockUSDC = await MockUSDC.deploy(ethers.parseUnits("1000000", 6));
    await mockUSDC.waitForDeployment();
    
    usdcAddress = await mockUSDC.getAddress();
    console.log("✅ Mock USDC deployed to:", usdcAddress);
  }
  
  if (!usdcAddress) {
    throw new Error(`USDC address not configured for network: ${network.name}. Set USDC_ADDRESS in .env file.`);
  }
  
  // =====================================
  // Deploy AgentRegistry
  // =====================================
  console.log("\n📦 Deploying AgentRegistry...");
  
  const agentRegistry = await deploy("AgentRegistry", {
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
    waitConfirmations: network.name === "hardhat" || network.name === "localhost" ? 1 : 5,
  });
  
  console.log("✅ AgentRegistry deployed to:", agentRegistry.address);
  
  // =====================================
  // Deploy AgentEscrow
  // =====================================
  console.log("\n📦 Deploying AgentEscrow...");
  
  const agentEscrow = await deploy("AgentEscrow", {
    from: deployer,
    args: [usdcAddress, agentRegistry.address],
    log: true,
    autoMine: true,
    waitConfirmations: network.name === "hardhat" || network.name === "localhost" ? 1 : 5,
  });
  
  console.log("✅ AgentEscrow deployed to:", agentEscrow.address);
  
  // =====================================
  // Setup permissions
  // =====================================
  console.log("\n🔧 Setting up permissions...");
  
  const agentRegistryContract = await ethers.getContractAt(
    "AgentRegistry",
    agentRegistry.address
  );
  
  // Grant VERIFIER_ROLE to deployer
  const VERIFIER_ROLE = await agentRegistryContract.VERIFIER_ROLE();
  const tx1 = await agentRegistryContract.grantRole(VERIFIER_ROLE, deployer);
  await tx1.wait();
  console.log("✅ VERIFIER_ROLE granted to deployer");
  
  // Grant ARBITRATOR_ROLE to deployer in AgentEscrow
  const agentEscrowContract = await ethers.getContractAt(
    "AgentEscrow",
    agentEscrow.address
  );
  
  const ARBITRATOR_ROLE = await agentEscrowContract.ARBITRATOR_ROLE();
  const tx2 = await agentEscrowContract.grantRole(ARBITRATOR_ROLE, deployer);
  await tx2.wait();
  console.log("✅ ARBITRATOR_ROLE granted to deployer");
  
  // =====================================
  // Save deployment info to JSON
  // =====================================
  console.log("\n📝 Saving deployment info...");
  
  const deploymentInfo = {
    network: network.name,
    chainId: network.config.chainId,
    deployer,
    usdc: usdcAddress,
    agentRegistry: agentRegistry.address,
    agentEscrow: agentEscrow.address,
    timestamp: new Date().toISOString(),
  };
  
  // Create deployments directory if it doesn't exist
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  // Save to network-specific file
  const deploymentPath = path.join(deploymentsDir, `${network.name}.json`);
  fs.writeFileSync(
    deploymentPath,
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log(`✅ Deployment info saved to: ${deploymentPath}`);
  
  // Save to latest.json for easy access
  const latestPath = path.join(deploymentsDir, "latest.json");
  fs.writeFileSync(
    latestPath,
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("✅ Deployment info saved to: deployments/latest.json");
  
  // =====================================
  // Print deployment summary
  // =====================================
  console.log("\n=====================================");
  console.log("🎉 Deployment Complete!");
  console.log("=====================================");
  console.log("Network:", network.name);
  console.log("Chain ID:", network.config.chainId);
  console.log("USDC Address:", usdcAddress);
  console.log("AgentRegistry:", agentRegistry.address);
  console.log("AgentEscrow:", agentEscrow.address);
  console.log("=====================================");
  
  console.log("\nDeployment Info (JSON):");
  console.log(JSON.stringify(deploymentInfo, null, 2));
  
  // =====================================
  // Verify contracts on Etherscan/Basescan
  // =====================================
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("\n🔍 Verifying contracts on explorer...");
    
    // Wait a bit for the contracts to be indexed
    console.log("⏳ Waiting for contracts to be indexed (10 seconds)...");
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Verify AgentRegistry (no constructor args)
    try {
      console.log("\nVerifying AgentRegistry...");
      await run("verify:verify", {
        address: agentRegistry.address,
        constructorArguments: [],
      });
      console.log("✅ AgentRegistry verified");
    } catch (error: any) {
      if (error.message.includes("Already Verified")) {
        console.log("✅ AgentRegistry already verified");
      } else {
        console.error("❌ AgentRegistry verification failed:", error.message);
      }
    }
    
    // Verify AgentEscrow (with constructor args)
    try {
      console.log("\nVerifying AgentEscrow...");
      await run("verify:verify", {
        address: agentEscrow.address,
        constructorArguments: [usdcAddress, agentRegistry.address],
      });
      console.log("✅ AgentEscrow verified");
    } catch (error: any) {
      if (error.message.includes("Already Verified")) {
        console.log("✅ AgentEscrow already verified");
      } else {
        console.error("❌ AgentEscrow verification failed:", error.message);
      }
    }
    
    console.log("\n=====================================");
    console.log("🔗 Explorer URLs:");
    console.log("=====================================");
    const explorerBase = network.name === "base" 
      ? "https://basescan.org" 
      : "https://sepolia.basescan.org";
    console.log(`AgentRegistry: ${explorerBase}/address/${agentRegistry.address}`);
    console.log(`AgentEscrow: ${explorerBase}/address/${agentEscrow.address}`);
    console.log("=====================================");
  }
};

deployContracts.tags = ["AgentMarketplace"];
deployContracts.dependencies = [];

export default deployContracts;
