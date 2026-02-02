import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";

/**
 * @dev Deployment script for AgentEscrow and AgentRegistry contracts
 * 
 * Deployment order:
 * 1. AgentRegistry - Agent identity and reputation contract
 * 2. AgentEscrow - Main escrow contract (depends on AgentRegistry)
 * 
 * Environment variables:
 * - USDC_ADDRESS: Address of USDC token on target network
 */

const deployContracts: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment
) {
  const { deployments, getNamedAccounts, network } = hre;
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
  };
  
  let usdcAddress = usdcAddresses[network.name];
  
  // For local testing, deploy a mock USDC token
  if (network.name === "hardhat" || network.name === "localhost") {
    console.log("\n📦 Deploying Mock USDC Token...");
    
    const mockUSDC = await deploy("MockUSDC", {
      from: deployer,
      contract: {
        abi: [
          "constructor(uint256 initialSupply)",
          "function mint(address to, uint256 amount)",
          "function approve(address spender, uint256 amount) returns (bool)",
          "function transfer(address to, uint256 amount) returns (bool)",
          "function transferFrom(address from, address to, uint256 amount) returns (bool)",
          "function balanceOf(address account) view returns (uint256)",
          "function allowance(address owner, address spender) view returns (uint256)",
          "function decimals() view returns (uint8)",
          "function name() view returns (string)",
          "function symbol() view returns (string)",
          "event Transfer(address indexed from, address indexed to, uint256 value)",
          "event Approval(address indexed owner, address indexed spender, uint256 value)",
        ],
        bytecode: "0x" + require("./MockUSDC.json").bytecode,
      },
      args: [ethers.parseUnits("1000000", 6)], // 1M USDC with 6 decimals
      log: true,
      autoMine: true,
    });
    
    usdcAddress = mockUSDC.address;
    console.log("✅ Mock USDC deployed to:", usdcAddress);
  }
  
  if (!usdcAddress) {
    throw new Error(`USDC address not configured for network: ${network.name}`);
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
    waitConfirmations: network.name === "hardhat" ? 1 : 5,
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
    waitConfirmations: network.name === "hardhat" ? 1 : 5,
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
  await (await agentRegistryContract.grantRole(VERIFIER_ROLE, deployer)).wait();
  console.log("✅ VERIFIER_ROLE granted to deployer");
  
  // Grant ARBITRATOR_ROLE to deployer in AgentEscrow
  const agentEscrowContract = await ethers.getContractAt(
    "AgentEscrow",
    agentEscrow.address
  );
  
  const ARBITRATOR_ROLE = await agentEscrowContract.ARBITRATOR_ROLE();
  await (await agentEscrowContract.grantRole(ARBITRATOR_ROLE, deployer)).wait();
  console.log("✅ ARBITRATOR_ROLE granted to deployer");
  
  // =====================================
  // Print deployment summary
  // =====================================
  console.log("\n=====================================");
  console.log("🎉 Deployment Complete!");
  console.log("=====================================");
  console.log("Network:", network.name);
  console.log("USDC Address:", usdcAddress);
  console.log("AgentRegistry:", agentRegistry.address);
  console.log("AgentEscrow:", agentEscrow.address);
  console.log("=====================================");
  
  // Save deployment info
  const deploymentInfo = {
    network: network.name,
    chainId: network.config.chainId,
    deployer,
    usdc: usdcAddress,
    agentRegistry: agentRegistry.address,
    agentEscrow: agentEscrow.address,
    timestamp: new Date().toISOString(),
  };
  
  console.log("\nDeployment Info (JSON):");
  console.log(JSON.stringify(deploymentInfo, null, 2));
  
  // Note: In production, you should verify contracts on Etherscan/Basescan
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("\n⚠️  Don't forget to verify contracts on the explorer!");
    console.log(`npx hardhat verify --network ${network.name} ${agentRegistry.address}`);
    console.log(`npx hardhat verify --network ${network.name} ${agentEscrow.address} ${usdcAddress} ${agentRegistry.address}`);
  }
};

deployContracts.tags = ["AgentMarketplace"];
deployContracts.dependencies = [];

export default deployContracts;