import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { AgentEscrow, AgentRegistry } from "../typechain-types";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("AgentEscrow", function () {
  let agentEscrow: AgentEscrow;
  let agentRegistry: AgentRegistry;
  let mockUSDC: any;
  
  let owner: SignerWithAddress;
  let creator: SignerWithAddress;
  let worker: SignerWithAddress;
  let worker2: SignerWithAddress;
  let arbitrator: SignerWithAddress;
  
  const BOUNTY = ethers.parseUnits("1000", 6); // 1000 USDC
  const METADATA_URI = "ipfs://QmTest123";
  const SUBMISSION_URI = "ipfs://QmSubmission456";
  
  beforeEach(async function () {
    [owner, creator, worker, worker2, arbitrator] = await ethers.getSigners();
    
    // Deploy Mock USDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy(ethers.parseUnits("1000000", 6));
    await mockUSDC.waitForDeployment();
    
    // Deploy AgentRegistry
    const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
    agentRegistry = await AgentRegistry.deploy();
    await agentRegistry.waitForDeployment();
    
    // Deploy AgentEscrow
    const AgentEscrow = await ethers.getContractFactory("AgentEscrow");
    agentEscrow = await AgentEscrow.deploy(
      await mockUSDC.getAddress(),
      await agentRegistry.getAddress()
    );
    await agentEscrow.waitForDeployment();
    
    // Setup roles
    await agentRegistry.grantRole(
      await agentRegistry.VERIFIER_ROLE(),
      owner.address
    );
    await agentEscrow.grantRole(
      await agentEscrow.ARBITRATOR_ROLE(),
      arbitrator.address
    );
    
    // Mint and approve USDC for testing
    await mockUSDC.mint(creator.address, ethers.parseUnits("10000", 6));
    await mockUSDC.mint(worker.address, ethers.parseUnits("5000", 6));
    await mockUSDC.mint(worker2.address, ethers.parseUnits("5000", 6));
    
    await mockUSDC
      .connect(creator)
      .approve(await agentEscrow.getAddress(), ethers.MaxUint256);
    await mockUSDC
      .connect(worker)
      .approve(await agentEscrow.getAddress(), ethers.MaxUint256);
    await mockUSDC
      .connect(worker2)
      .approve(await agentEscrow.getAddress(), ethers.MaxUint256);
    
    // Register agents
    await agentRegistry
      .connect(worker)
      .registerAgent("worker-public-key", "ipfs://worker-profile");
    await agentRegistry
      .connect(worker2)
      .registerAgent("worker2-public-key", "ipfs://worker2-profile");
  });
  
  describe("Deployment", function () {
    it("Should set the correct USDC token address", async function () {
      expect(await agentEscrow.usdc()).to.equal(await mockUSDC.getAddress());
    });
    
    it("Should set the correct AgentRegistry address", async function () {
      expect(await agentEscrow.agentRegistry()).to.equal(
        await agentRegistry.getAddress()
      );
    });
    
    it("Should grant admin role to deployer", async function () {
      expect(
        await agentEscrow.hasRole(await agentEscrow.ADMIN_ROLE(), owner.address)
      ).to.be.true;
    });
    
    it("Should have correct constants", async function () {
      expect(await agentEscrow.AUTO_APPROVE_PERIOD()).to.equal(48 * 60 * 60); // 48 hours
      expect(await agentEscrow.WORKER_STAKE_PERCENTAGE()).to.equal(10);
      expect(await agentEscrow.PLATFORM_FEE_PERCENTAGE()).to.equal(2);
    });
  });
  
  describe("Task Creation", function () {
    it("Should create a task with correct details", async function () {
      const tx = await agentEscrow
        .connect(creator)
        .createTask(BOUNTY, METADATA_URI);
      
      await expect(tx)
        .to.emit(agentEscrow, "TaskCreated")
        .withArgs(0, creator.address, BOUNTY, METADATA_URI);
      
      const task = await agentEscrow.getTask(0);
      expect(task.creator).to.equal(creator.address);
      expect(task.bounty).to.equal(BOUNTY);
      expect(task.metadataURI).to.equal(METADATA_URI);
      expect(task.status).to.equal(0); // TaskStatus.Open
    });
    
    it("Should revert with zero bounty", async function () {
      await expect(
        agentEscrow.connect(creator).createTask(0, METADATA_URI)
      ).to.be.revertedWithCustomError(agentEscrow, "InvalidBounty");
    });
    
    it("Should revert with empty metadata", async function () {
      await expect(
        agentEscrow.connect(creator).createTask(BOUNTY, "")
      ).to.be.revertedWithCustomError(agentEscrow, "InvalidMetadata");
    });
    
    it("Should transfer USDC from creator to escrow", async function () {
      const creatorBalanceBefore = await mockUSDC.balanceOf(creator.address);
      
      await agentEscrow.connect(creator).createTask(BOUNTY, METADATA_URI);
      
      const creatorBalanceAfter = await mockUSDC.balanceOf(creator.address);
      expect(creatorBalanceBefore - creatorBalanceAfter).to.equal(BOUNTY);
      
      const escrowBalance = await mockUSDC.balanceOf(
        await agentEscrow.getAddress()
      );
      expect(escrowBalance).to.equal(BOUNTY);
    });
    
    it("Should track creator tasks", async function () {
      await agentEscrow.connect(creator).createTask(BOUNTY, METADATA_URI);
      await agentEscrow.connect(creator).createTask(BOUNTY, METADATA_URI);
      
      const tasks = await agentEscrow.getCreatorTasks(creator.address);
      expect(tasks.length).to.equal(2);
      expect(tasks[0]).to.equal(0);
      expect(tasks[1]).to.equal(1);
    });
  });
  
  describe("Task Claiming", function () {
    beforeEach(async function () {
      await agentEscrow.connect(creator).createTask(BOUNTY, METADATA_URI);
    });
    
    it("Should allow registered agent to claim task", async function () {
      const requiredStake = (BOUNTY * 10n) / 100n; // 10% of bounty
      
      const tx = await agentEscrow.connect(worker).claimTask(0);
      
      await expect(tx)
        .to.emit(agentEscrow, "TaskClaimed")
        .withArgs(0, worker.address, requiredStake);
      
      const task = await agentEscrow.getTask(0);
      expect(task.worker).to.equal(worker.address);
      expect(task.workerStake).to.equal(requiredStake);
      expect(task.status).to.equal(1); // TaskStatus.Claimed
    });
    
    it("Should revert if agent not registered", async function () {
      await expect(
        agentEscrow.connect(creator).claimTask(0)
      ).to.be.revertedWithCustomError(agentEscrow, "AgentNotRegistered");
    });
    
    it("Should revert if task not open", async function () {
      await agentEscrow.connect(worker).claimTask(0);
      
      await expect(
        agentEscrow.connect(worker2).claimTask(0)
      ).to.be.revertedWithCustomError(agentEscrow, "TaskNotOpen");
    });
    
    it("Should transfer stake from worker", async function () {
      const requiredStake = (BOUNTY * 10n) / 100n;
      const workerBalanceBefore = await mockUSDC.balanceOf(worker.address);
      
      await agentEscrow.connect(worker).claimTask(0);
      
      const workerBalanceAfter = await mockUSDC.balanceOf(worker.address);
      expect(workerBalanceBefore - workerBalanceAfter).to.equal(requiredStake);
    });
    
    it("Should track worker tasks", async function () {
      await agentEscrow.connect(worker).claimTask(0);
      
      const tasks = await agentEscrow.getWorkerTasks(worker.address);
      expect(tasks.length).to.equal(1);
      expect(tasks[0]).to.equal(0);
    });
  });
  
  describe("Work Submission", function () {
    beforeEach(async function () {
      await agentEscrow.connect(creator).createTask(BOUNTY, METADATA_URI);
      await agentEscrow.connect(worker).claimTask(0);
    });
    
    it("Should allow worker to submit work", async function () {
      const tx = await agentEscrow
        .connect(worker)
        .submitWork(0, SUBMISSION_URI);
      
      await expect(tx)
        .to.emit(agentEscrow, "WorkSubmitted")
        .withArgs(0, worker.address, SUBMISSION_URI);
      
      const task = await agentEscrow.getTask(0);
      expect(task.submissionURI).to.equal(SUBMISSION_URI);
      expect(task.status).to.equal(2); // TaskStatus.Submitted
    });
    
    it("Should revert if not task worker", async function () {
      await expect(
        agentEscrow.connect(worker2).submitWork(0, SUBMISSION_URI)
      ).to.be.revertedWithCustomError(agentEscrow, "NotTaskWorker");
    });
    
    it("Should revert if task not claimed", async function () {
      await agentEscrow.connect(creator).createTask(BOUNTY, METADATA_URI);
      
      await expect(
        agentEscrow.connect(worker).submitWork(1, SUBMISSION_URI)
      ).to.be.revertedWithCustomError(agentEscrow, "TaskNotClaimed");
    });
    
    it("Should revert with empty submission URI", async function () {
      await expect(
        agentEscrow.connect(worker).submitWork(0, "")
      ).to.be.revertedWithCustomError(agentEscrow, "InvalidMetadata");
    });
  });
  
  describe("Work Approval", function () {
    beforeEach(async function () {
      await agentEscrow.connect(creator).createTask(BOUNTY, METADATA_URI);
      await agentEscrow.connect(worker).claimTask(0);
      await agentEscrow.connect(worker).submitWork(0, SUBMISSION_URI);
    });
    
    it("Should allow creator to approve work", async function () {
      const tx = await agentEscrow.connect(creator).approveWork(0);
      
      await expect(tx)
        .to.emit(agentEscrow, "WorkApproved")
        .withArgs(0, creator.address, false);
      
      const task = await agentEscrow.getTask(0);
      expect(task.status).to.equal(3); // TaskStatus.Approved
      expect(task.creatorApproved).to.be.true;
    });
    
    it("Should distribute payment on approval", async function () {
      const platformFee = (BOUNTY * 2n) / 100n; // 2%
      const requiredStake = (BOUNTY * 10n) / 100n; // 10%
      const workerAmount = BOUNTY + requiredStake - platformFee;
      
      const workerBalanceBefore = await mockUSDC.balanceOf(worker.address);
      
      await agentEscrow.connect(creator).approveWork(0);
      
      const workerBalanceAfter = await mockUSDC.balanceOf(worker.address);
      expect(workerBalanceAfter - workerBalanceBefore).to.equal(workerAmount);
    });
    
    it("Should revert if not creator", async function () {
      await expect(
        agentEscrow.connect(worker).approveWork(0)
      ).to.be.revertedWithCustomError(agentEscrow, "NotTaskCreator");
    });
    
    it("Should revert if work not submitted", async function () {
      await agentEscrow.connect(creator).createTask(BOUNTY, METADATA_URI);
      await agentEscrow.connect(worker).claimTask(1);
      
      await expect(
        agentEscrow.connect(creator).approveWork(1)
      ).to.be.revertedWithCustomError(agentEscrow, "TaskNotSubmitted");
    });
    
    it("Should revert after auto-approve period", async function () {
      await time.increase(48 * 60 * 60 + 1); // 48 hours + 1 second
      
      await expect(
        agentEscrow.connect(creator).approveWork(0)
      ).to.be.revertedWithCustomError(agentEscrow, "AutoApprovePeriodPassed");
    });
  });
  
  describe("Auto-Approve", function () {
    beforeEach(async function () {
      await agentEscrow.connect(creator).createTask(BOUNTY, METADATA_URI);
      await agentEscrow.connect(worker).claimTask(0);
      await agentEscrow.connect(worker).submitWork(0, SUBMISSION_URI);
    });
    
    it("Should allow auto-approve after 48 hours", async function () {
      await time.increase(48 * 60 * 60 + 1);
      
      const tx = await agentEscrow.autoApproveWork(0);
      
      await expect(tx)
        .to.emit(agentEscrow, "WorkApproved")
        .withArgs(0, ethers.ZeroAddress, true);
      
      const task = await agentEscrow.getTask(0);
      expect(task.status).to.equal(3); // TaskStatus.Approved
      expect(task.autoApproved).to.be.true;
    });
    
    it("Should revert auto-approve before 48 hours", async function () {
      await expect(
        agentEscrow.autoApproveWork(0)
      ).to.be.revertedWithCustomError(agentEscrow, "AutoApprovePeriodNotReached");
    });
    
    it("Should report correct auto-approve status", async function () {
      expect(await agentEscrow.canAutoApprove(0)).to.be.false;
      
      await time.increase(48 * 60 * 60 + 1);
      
      expect(await agentEscrow.canAutoApprove(0)).to.be.true;
    });
    
    it("Should report time until auto-approve", async function () {
      const timeRemaining = await agentEscrow.timeUntilAutoApprove(0);
      expect(timeRemaining).to.be.closeTo(48n * 60n * 60n, 5n);
      
      await time.increase(24 * 60 * 60); // 24 hours
      
      const timeRemaining2 = await agentEscrow.timeUntilAutoApprove(0);
      expect(timeRemaining2).to.be.closeTo(24n * 60n * 60n, 5n);
    });
  });
  
  describe("Disputes", function () {
    beforeEach(async function () {
      await agentEscrow.connect(creator).createTask(BOUNTY, METADATA_URI);
      await agentEscrow.connect(worker).claimTask(0);
      await agentEscrow.connect(worker).submitWork(0, SUBMISSION_URI);
    });
    
    it("Should allow creator to open dispute", async function () {
      const tx = await agentEscrow
        .connect(creator)
        .openDispute(0, "Work not satisfactory");
      
      await expect(tx)
        .to.emit(agentEscrow, "DisputeOpened")
        .withArgs(0, 0, creator.address, "Work not satisfactory");
      
      const task = await agentEscrow.getTask(0);
      expect(task.status).to.equal(4); // TaskStatus.Disputed
      expect(task.disputeId).to.equal(0);
    });
    
    it("Should allow worker to open dispute", async function () {
      const tx = await agentEscrow
        .connect(worker)
        .openDispute(0, "Creator not responding");
      
      await expect(tx)
        .to.emit(agentEscrow, "DisputeOpened")
        .withArgs(0, 0, worker.address, "Creator not responding");
    });
    
    it("Should revert if not creator or worker", async function () {
      await expect(
        agentEscrow.connect(worker2).openDispute(0, "Reason")
      ).to.be.revertedWithCustomError(agentEscrow, "NotTaskCreator");
    });
    
    it("Should revert if dispute already exists", async function () {
      await agentEscrow.connect(creator).openDispute(0, "Reason 1");
      
      await expect(
        agentEscrow.connect(worker).openDispute(0, "Reason 2")
      ).to.be.revertedWithCustomError(agentEscrow, "DisputeAlreadyExists");
    });
    
    it("Should revert dispute after auto-approve period", async function () {
      await time.increase(48 * 60 * 60 + 1);
      
      await expect(
        agentEscrow.connect(creator).openDispute(0, "Too late")
      ).to.be.revertedWithCustomError(agentEscrow, "AutoApprovePeriodPassed");
    });
  });
  
  describe("Dispute Resolution", function () {
    beforeEach(async function () {
      await agentEscrow.connect(creator).createTask(BOUNTY, METADATA_URI);
      await agentEscrow.connect(worker).claimTask(0);
      await agentEscrow.connect(worker).submitWork(0, SUBMISSION_URI);
      await agentEscrow.connect(creator).openDispute(0, "Quality issues");
    });
    
    it("Should allow arbitrator to resolve in favor of worker", async function () {
      const tx = await agentEscrow
        .connect(arbitrator)
        .resolveDispute(0, worker.address, "Worker wins - work acceptable");
      
      await expect(tx)
        .to.emit(agentEscrow, "DisputeResolved")
        .withArgs(0, 0, worker.address, "Worker wins - work acceptable");
      
      const task = await agentEscrow.getTask(0);
      expect(task.status).to.equal(5); // TaskStatus.Resolved
    });
    
    it("Should pay worker when worker wins dispute", async function () {
      const workerBalanceBefore = await mockUSDC.balanceOf(worker.address);
      
      await agentEscrow
        .connect(arbitrator)
        .resolveDispute(0, worker.address, "Worker wins");
      
      const workerBalanceAfter = await mockUSDC.balanceOf(worker.address);
      expect(workerBalanceAfter).to.be.gt(workerBalanceBefore);
    });
    
    it("Should return bounty to creator when creator wins", async function () {
      const creatorBalanceBefore = await mockUSDC.balanceOf(creator.address);
      
      await agentEscrow
        .connect(arbitrator)
        .resolveDispute(0, creator.address, "Creator wins");
      
      const creatorBalanceAfter = await mockUSDC.balanceOf(creator.address);
      expect(creatorBalanceAfter - creatorBalanceBefore).to.equal(BOUNTY);
    });
    
    it("Should slash worker stake when creator wins", async function () {
      await agentEscrow
        .connect(arbitrator)
        .resolveDispute(0, creator.address, "Creator wins");
      
      const fees = await agentEscrow.totalFeesCollected();
      const expectedStake = (BOUNTY * 10n) / 100n;
      expect(fees).to.equal(expectedStake);
    });
    
    it("Should revert if not arbitrator", async function () {
      await expect(
        agentEscrow.connect(creator).resolveDispute(0, worker.address, "")
      ).to.be.revertedWithCustomError(
        agentEscrow,
        "AccessControlUnauthorizedAccount"
      );
    });
    
    it("Should revert with invalid winner address", async function () {
      await expect(
        agentEscrow
          .connect(arbitrator)
          .resolveDispute(0, worker2.address, "Invalid")
      ).to.be.revertedWithCustomError(agentEscrow, "InvalidResolution");
    });
  });
  
  describe("Task Cancellation", function () {
    it("Should allow creator to cancel open task", async function () {
      await agentEscrow.connect(creator).createTask(BOUNTY, METADATA_URI);
      
      const creatorBalanceBefore = await mockUSDC.balanceOf(creator.address);
      
      const tx = await agentEscrow.connect(creator).cancelTask(0);
      
      await expect(tx)
        .to.emit(agentEscrow, "TaskCancelled")
        .withArgs(0, creator.address);
      
      const task = await agentEscrow.getTask(0);
      expect(task.status).to.equal(6); // TaskStatus.Cancelled
      
      const creatorBalanceAfter = await mockUSDC.balanceOf(creator.address);
      expect(creatorBalanceAfter - creatorBalanceBefore).to.equal(BOUNTY);
    });
    
    it("Should revert cancellation if task claimed", async function () {
      await agentEscrow.connect(creator).createTask(BOUNTY, METADATA_URI);
      await agentEscrow.connect(worker).claimTask(0);
      
      await expect(
        agentEscrow.connect(creator).cancelTask(0)
      ).to.be.revertedWithCustomError(agentEscrow, "CannotCancelClaimedTask");
    });
    
    it("Should revert if not creator", async function () {
      await agentEscrow.connect(creator).createTask(BOUNTY, METADATA_URI);
      
      await expect(
        agentEscrow.connect(worker).cancelTask(0)
      ).to.be.revertedWithCustomError(agentEscrow, "NotTaskCreator");
    });
  });
  
  describe("Platform Fees", function () {
    it("Should track platform fees", async function () {
      await agentEscrow.connect(creator).createTask(BOUNTY, METADATA_URI);
      await agentEscrow.connect(worker).claimTask(0);
      await agentEscrow.connect(worker).submitWork(0, SUBMISSION_URI);
      await agentEscrow.connect(creator).approveWork(0);
      
      const expectedFee = (BOUNTY * 2n) / 100n; // 2%
      expect(await agentEscrow.totalFeesCollected()).to.equal(expectedFee);
    });
    
    it("Should allow admin to withdraw fees", async function () {
      await agentEscrow.connect(creator).createTask(BOUNTY, METADATA_URI);
      await agentEscrow.connect(worker).claimTask(0);
      await agentEscrow.connect(worker).submitWork(0, SUBMISSION_URI);
      await agentEscrow.connect(creator).approveWork(0);
      
      const expectedFee = (BOUNTY * 2n) / 100n;
      const ownerBalanceBefore = await mockUSDC.balanceOf(owner.address);
      
      await agentEscrow.connect(owner).withdrawFees();
      
      const ownerBalanceAfter = await mockUSDC.balanceOf(owner.address);
      expect(ownerBalanceAfter - ownerBalanceBefore).to.equal(expectedFee);
      expect(await agentEscrow.totalFeesCollected()).to.equal(0);
    });
    
    it("Should revert fee withdrawal if not admin", async function () {
      await expect(
        agentEscrow.connect(creator).withdrawFees()
      ).to.be.revertedWithCustomError(
        agentEscrow,
        "AccessControlUnauthorizedAccount"
      );
    });
  });
  
  describe("Admin Functions", function () {
    it("Should allow admin to pause and unpause", async function () {
      await agentEscrow.connect(owner).pause();
      
      await expect(
        agentEscrow.connect(creator).createTask(BOUNTY, METADATA_URI)
      ).to.be.revertedWithCustomError(agentEscrow, "EnforcedPause");
      
      await agentEscrow.connect(owner).unpause();
      
      await expect(
        agentEscrow.connect(creator).createTask(BOUNTY, METADATA_URI)
      ).to.not.be.reverted;
    });
    
    it("Should allow admin to update USDC address", async function () {
      const newUSDC = ethers.Wallet.createRandom().address;
      
      await agentEscrow.connect(owner).setUSDC(newUSDC);
      
      expect(await agentEscrow.usdc()).to.equal(newUSDC);
    });
    
    it("Should allow admin to update registry address", async function () {
      const newRegistry = ethers.Wallet.createRandom().address;
      
      await agentEscrow.connect(owner).setAgentRegistry(newRegistry);
      
      expect(await agentEscrow.agentRegistry()).to.equal(newRegistry);
    });
  });
  
  describe("Reputation Integration", function () {
    it("Should update reputation on successful completion", async function () {
      await agentEscrow.connect(creator).createTask(BOUNTY, METADATA_URI);
      await agentEscrow.connect(worker).claimTask(0);
      await agentEscrow.connect(worker).submitWork(0, SUBMISSION_URI);
      
      const reputationBefore = (await agentRegistry.getAgent(worker.address))
        .reputationScore;
      
      await agentEscrow.connect(creator).approveWork(0);
      
      const reputationAfter = (await agentRegistry.getAgent(worker.address))
        .reputationScore;
      expect(reputationAfter).to.be.gt(reputationBefore);
    });
    
    it("Should decrease reputation on dispute loss", async function () {
      await agentEscrow.connect(creator).createTask(BOUNTY, METADATA_URI);
      await agentEscrow.connect(worker).claimTask(0);
      await agentEscrow.connect(worker).submitWork(0, SUBMISSION_URI);
      await agentEscrow.connect(creator).openDispute(0, "Quality issues");
      
      const reputationBefore = (await agentRegistry.getAgent(worker.address))
        .reputationScore;
      
      await agentEscrow
        .connect(arbitrator)
        .resolveDispute(0, creator.address, "Worker loses");
      
      const reputationAfter = (await agentRegistry.getAgent(worker.address))
        .reputationScore;
      expect(reputationAfter).to.be.lt(reputationBefore);
    });
  });
});