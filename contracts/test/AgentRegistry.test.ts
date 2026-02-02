import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { AgentRegistry } from "../typechain-types";

describe("AgentRegistry", function () {
  let agentRegistry: AgentRegistry;
  let owner: SignerWithAddress;
  let agent1: SignerWithAddress;
  let agent2: SignerWithAddress;
  let verifier: SignerWithAddress;
  
  const PUBLIC_KEY = "pgp-public-key-123";
  const METADATA_URI = "ipfs://QmProfile123";
  
  beforeEach(async function () {
    [owner, agent1, agent2, verifier] = await ethers.getSigners();
    
    const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
    agentRegistry = await AgentRegistry.deploy();
    await agentRegistry.waitForDeployment();
    
    // Grant verifier role
    await agentRegistry.grantRole(
      await agentRegistry.VERIFIER_ROLE(),
      verifier.address
    );
  });
  
  describe("Deployment", function () {
    it("Should set correct roles for deployer", async function () {
      expect(
        await agentRegistry.hasRole(
          await agentRegistry.DEFAULT_ADMIN_ROLE(),
          owner.address
        )
      ).to.be.true;
      expect(
        await agentRegistry.hasRole(
          await agentRegistry.ADMIN_ROLE(),
          owner.address
        )
      ).to.be.true;
      expect(
        await agentRegistry.hasRole(
          await agentRegistry.VERIFIER_ROLE(),
          owner.address
        )
      ).to.be.true;
    });
  });
  
  describe("Registration", function () {
    it("Should register a new agent", async function () {
      const tx = await agentRegistry
        .connect(agent1)
        .registerAgent(PUBLIC_KEY, METADATA_URI);
      
      await expect(tx)
        .to.emit(agentRegistry, "AgentRegistered")
        .withArgs(agent1.address, PUBLIC_KEY, METADATA_URI);
      
      expect(await agentRegistry.isRegistered(agent1.address)).to.be.true;
      
      const agent = await agentRegistry.getAgent(agent1.address);
      expect(agent.agentAddress).to.equal(agent1.address);
      expect(agent.publicKey).to.equal(PUBLIC_KEY);
      expect(agent.metadataURI).to.equal(METADATA_URI);
      expect(agent.isActive).to.be.true;
      expect(agent.reputationScore).to.equal(5000); // Base reputation
    });
    
    it("Should revert if already registered", async function () {
      await agentRegistry.connect(agent1).registerAgent(PUBLIC_KEY, METADATA_URI);
      
      await expect(
        agentRegistry.connect(agent1).registerAgent(PUBLIC_KEY, METADATA_URI)
      ).to.be.revertedWithCustomError(agentRegistry, "AlreadyRegistered");
    });
    
    it("Should revert with empty public key", async function () {
      await expect(
        agentRegistry.connect(agent1).registerAgent("", METADATA_URI)
      ).to.be.revertedWithCustomError(agentRegistry, "InvalidPublicKey");
    });
    
    it("Should revert with empty metadata", async function () {
      await expect(
        agentRegistry.connect(agent1).registerAgent(PUBLIC_KEY, "")
      ).to.be.revertedWithCustomError(agentRegistry, "InvalidMetadata");
    });
    
    it("Should track all registered agents", async function () {
      await agentRegistry.connect(agent1).registerAgent(PUBLIC_KEY, METADATA_URI);
      await agentRegistry.connect(agent2).registerAgent("key2", "meta2");
      
      expect(await agentRegistry.getAgentCount()).to.equal(2);
    });
  });
  
  describe("Profile Updates", function () {
    beforeEach(async function () {
      await agentRegistry.connect(agent1).registerAgent(PUBLIC_KEY, METADATA_URI);
    });
    
    it("Should update agent profile", async function () {
      const newKey = "new-public-key";
      const newMeta = "ipfs://new-profile";
      
      await expect(agentRegistry.connect(agent1).updateAgent(newKey, newMeta))
        .to.emit(agentRegistry, "AgentUpdated")
        .withArgs(agent1.address, newKey, newMeta);
      
      const agent = await agentRegistry.getAgent(agent1.address);
      expect(agent.publicKey).to.equal(newKey);
      expect(agent.metadataURI).to.equal(newMeta);
    });
    
    it("Should deactivate and reactivate agent", async function () {
      await agentRegistry.connect(agent1).deactivateAgent();
      
      let agent = await agentRegistry.getAgent(agent1.address);
      expect(agent.isActive).to.be.false;
      
      await agentRegistry.connect(agent1).reactivateAgent();
      
      agent = await agentRegistry.getAgent(agent1.address);
      expect(agent.isActive).to.be.true;
    });
  });
  
  describe("Skills", function () {
    beforeEach(async function () {
      await agentRegistry.connect(agent1).registerAgent(PUBLIC_KEY, METADATA_URI);
    });
    
    it("Should add a skill", async function () {
      const tx = await agentRegistry
        .connect(agent1)
        .addSkill("Solidity", "Blockchain", 4);
      
      const skillHash = ethers.keccak256(
        ethers.solidityPacked(["string", "string"], ["Solidity", "Blockchain"])
      );
      
      await expect(tx)
        .to.emit(agentRegistry, "SkillAdded")
        .withArgs(agent1.address, skillHash, "Solidity", "Blockchain", 4);
      
      const skills = await agentRegistry.getAgentSkills(agent1.address);
      expect(skills.length).to.equal(1);
      expect(skills[0]).to.equal(skillHash);
    });
    
    it("Should verify a skill", async function () {
      await agentRegistry.connect(agent1).addSkill("Solidity", "Blockchain", 4);
      
      const skillHash = ethers.keccak256(
        ethers.solidityPacked(["string", "string"], ["Solidity", "Blockchain"])
      );
      
      const proof = "ipfs://verification-proof";
      
      await expect(
        agentRegistry.connect(verifier).verifySkill(agent1.address, skillHash, proof)
      )
        .to.emit(agentRegistry, "SkillVerified")
        .withArgs(agent1.address, skillHash, verifier.address, proof);
      
      const skill = await agentRegistry.getSkill(agent1.address, skillHash);
      expect(skill.verifiedAt).to.be.gt(0);
      expect(skill.verifier).to.equal(verifier.address);
    });
    
    it("Should revert self-verification", async function () {
      await agentRegistry.connect(agent1).addSkill("Solidity", "Blockchain", 4);
      
      const skillHash = ethers.keccak256(
        ethers.solidityPacked(["string", "string"], ["Solidity", "Blockchain"])
      );
      
      await expect(
        agentRegistry.connect(agent1).verifySkill(agent1.address, skillHash, "proof")
      ).to.be.revertedWithCustomError(agentRegistry, "CannotSelfVerify");
    });
    
    it("Should check if agent has skill", async function () {
      await agentRegistry.connect(agent1).addSkill("Solidity", "Blockchain", 4);
      
      expect(
        await agentRegistry.hasSkill(agent1.address, "Solidity", "Blockchain")
      ).to.be.true;
      
      expect(
        await agentRegistry.hasSkill(agent1.address, "Rust", "Blockchain")
      ).to.be.false;
    });
  });
  
  describe("Reputation", function () {
    beforeEach(async function () {
      await agentRegistry.connect(agent1).registerAgent(PUBLIC_KEY, METADATA_URI);
    });
    
    it("Should have base reputation on registration", async function () {
      const agent = await agentRegistry.getAgent(agent1.address);
      expect(agent.reputationScore).to.equal(5000);
    });
    
    it("Should increase reputation on completion", async function () {
      await agentRegistry.recordCompletion(agent1.address, 1, true);
      
      const agent = await agentRegistry.getAgent(agent1.address);
      expect(agent.reputationScore).to.equal(5100); // +100 for completion
      expect(agent.totalTasksCompleted).to.equal(1);
    });
    
    it("Should decrease reputation on failure", async function () {
      await agentRegistry.recordCompletion(agent1.address, 1, false);
      
      const agent = await agentRegistry.getAgent(agent1.address);
      expect(agent.reputationScore).to.equal(4800); // -200 for failure
      expect(agent.totalTasksFailed).to.equal(1);
    });
    
    it("Should track reputation history", async function () {
      await agentRegistry.recordCompletion(agent1.address, 1, true);
      await agentRegistry.recordCompletion(agent1.address, 2, false);
      
      const history = await agentRegistry.getReputationHistory(agent1.address);
      expect(history.length).to.equal(2);
      expect(history[0].change).to.equal(100);
      expect(history[1].change).to.equal(-200);
    });
    
    it("Should return reputation percentage", async function () {
      expect(await agentRegistry.getReputationPercentage(agent1.address)).to.equal(50);
      
      await agentRegistry.recordCompletion(agent1.address, 1, true);
      expect(await agentRegistry.getReputationPercentage(agent1.address)).to.equal(51);
    });
    
    it("Should allow admin to adjust reputation", async function () {
      await agentRegistry
        .connect(owner)
        .adjustReputation(agent1.address, 500, "Bonus for excellence");
      
      const agent = await agentRegistry.getAgent(agent1.address);
      expect(agent.reputationScore).to.equal(5500);
    });
  });
  
  describe("Earnings", function () {
    beforeEach(async function () {
      await agentRegistry.connect(agent1).registerAgent(PUBLIC_KEY, METADATA_URI);
    });
    
    it("Should track total earnings", async function () {
      await agentRegistry.recordEarnings(agent1.address, ethers.parseEther("1"));
      await agentRegistry.recordEarnings(agent1.address, ethers.parseEther("2"));
      
      const agent = await agentRegistry.getAgent(agent1.address);
      expect(agent.totalEarnings).to.equal(ethers.parseEther("3"));
    });
  });
  
  describe("Pagination", function () {
    beforeEach(async function () {
      await agentRegistry.connect(agent1).registerAgent(PUBLIC_KEY, METADATA_URI);
      await agentRegistry.connect(agent2).registerAgent("key2", "meta2");
    });
    
    it("Should return agents by page", async function () {
      const page1 = await agentRegistry.getAgentsByPage(0, 1);
      expect(page1.length).to.equal(1);
      expect(page1[0]).to.equal(agent1.address);
      
      const page2 = await agentRegistry.getAgentsByPage(1, 1);
      expect(page2.length).to.equal(1);
      expect(page2[0]).to.equal(agent2.address);
    });
    
    it("Should handle empty pages", async function () {
      const page = await agentRegistry.getAgentsByPage(10, 10);
      expect(page.length).to.equal(0);
    });
  });
  
  describe("Admin Functions", function () {
    it("Should pause and unpause", async function () {
      await agentRegistry.connect(owner).pause();
      
      await expect(
        agentRegistry.connect(agent1).registerAgent(PUBLIC_KEY, METADATA_URI)
      ).to.be.revertedWithCustomError(agentRegistry, "EnforcedPause");
      
      await agentRegistry.connect(owner).unpause();
      
      await expect(
        agentRegistry.connect(agent1).registerAgent(PUBLIC_KEY, METADATA_URI)
      ).to.not.be.reverted;
    });
  });
});