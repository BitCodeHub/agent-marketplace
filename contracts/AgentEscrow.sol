// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./AgentRegistry.sol";

/**
 * @title AgentEscrow
 * @dev Escrow contract for AI Agent Marketplace tasks
 * - Tasks are created with USDC bounties
 * - Workers claim tasks with 10% stake
 * - Work submission and approval flow
 * - Auto-approve after 48 hours
 * - Dispute handling mechanism
 */
contract AgentEscrow is ReentrancyGuard, AccessControl, Pausable {
    
    bytes32 public constant ARBITRATOR_ROLE = keccak256("ARBITRATOR_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    uint256 public constant AUTO_APPROVE_PERIOD = 48 hours;
    uint256 public constant WORKER_STAKE_PERCENTAGE = 10; // 10% of bounty
    uint256 public constant PLATFORM_FEE_PERCENTAGE = 2; // 2% platform fee
    
    IERC20 public usdc;
    AgentRegistry public agentRegistry;
    
    enum TaskStatus {
        Open,
        Claimed,
        Submitted,
        Approved,
        Disputed,
        Resolved,
        Cancelled
    }
    
    struct Task {
        uint256 id;
        address creator;
        address worker;
        uint256 bounty;
        uint256 workerStake;
        string metadataURI; // IPFS hash with task details
        TaskStatus status;
        uint256 createdAt;
        uint256 claimedAt;
        uint256 submittedAt;
        string submissionURI; // IPFS hash with work submission
        uint256 disputeId;
        bool creatorApproved;
        bool autoApproved;
    }
    
    struct Dispute {
        uint256 id;
        uint256 taskId;
        address initiator;
        string reason;
        uint256 createdAt;
        bool resolved;
        address winner; // address that won the dispute
        string resolution;
    }
    
    uint256 public nextTaskId;
    uint256 public nextDisputeId;
    uint256 public totalFeesCollected;
    
    mapping(uint256 => Task) public tasks;
    mapping(uint256 => Dispute) public disputes;
    mapping(address => uint256[]) public creatorTasks;
    mapping(address => uint256[]) public workerTasks;
    
    // Events
    event TaskCreated(
        uint256 indexed taskId,
        address indexed creator,
        uint256 bounty,
        string metadataURI
    );
    
    event TaskClaimed(
        uint256 indexed taskId,
        address indexed worker,
        uint256 stakeAmount
    );
    
    event WorkSubmitted(
        uint256 indexed taskId,
        address indexed worker,
        string submissionURI
    );
    
    event WorkApproved(
        uint256 indexed taskId,
        address indexed approver,
        bool autoApproved
    );
    
    event TaskCancelled(
        uint256 indexed taskId,
        address indexed canceller
    );
    
    event DisputeOpened(
        uint256 indexed disputeId,
        uint256 indexed taskId,
        address indexed initiator,
        string reason
    );
    
    event DisputeResolved(
        uint256 indexed disputeId,
        uint256 indexed taskId,
        address indexed winner,
        string resolution
    );
    
    event PaymentDistributed(
        uint256 indexed taskId,
        address indexed worker,
        uint256 workerAmount,
        uint256 platformFee
    );
    
    event FeesWithdrawn(address indexed admin, uint256 amount);
    
    // Errors
    error InvalidBounty();
    error InvalidMetadata();
    error TaskNotOpen();
    error TaskNotClaimed();
    error TaskNotSubmitted();
    error NotTaskCreator();
    error NotTaskWorker();
    error InsufficientStake();
    error AlreadyClaimed();
    error TransferFailed();
    error AutoApprovePeriodNotReached();
    error AutoApprovePeriodPassed();
    error DisputeAlreadyExists();
    error DisputeNotFound();
    error DisputeAlreadyResolved();
    error InvalidResolution();
    error TaskCancelledOrResolved();
    error AgentNotRegistered();
    error CannotCancelClaimedTask();
    
    constructor(address _usdc, address _agentRegistry) {
        require(_usdc != address(0), "Invalid USDC address");
        require(_agentRegistry != address(0), "Invalid registry address");
        
        usdc = IERC20(_usdc);
        agentRegistry = AgentRegistry(_agentRegistry);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(ARBITRATOR_ROLE, msg.sender);
    }
    
    /**
     * @dev Create a new task with USDC bounty
     * @param _bounty Amount of USDC to offer as bounty
     * @param _metadataURI IPFS hash containing task details
     */
    function createTask(uint256 _bounty, string calldata _metadataURI) 
        external 
        nonReentrant 
        whenNotPaused 
        returns (uint256 taskId 
    ) {
        if (_bounty == 0) revert InvalidBounty();
        if (bytes(_metadataURI).length == 0) revert InvalidMetadata();
        
        // Transfer bounty from creator to escrow
        bool success = usdc.transferFrom(msg.sender, address(this), _bounty);
        if (!success) revert TransferFailed();
        
        taskId = nextTaskId++;
        
        tasks[taskId] = Task({
            id: taskId,
            creator: msg.sender,
            worker: address(0),
            bounty: _bounty,
            workerStake: 0,
            metadataURI: _metadataURI,
            status: TaskStatus.Open,
            createdAt: block.timestamp,
            claimedAt: 0,
            submittedAt: 0,
            submissionURI: "",
            disputeId: 0,
            creatorApproved: false,
            autoApproved: false
        });
        
        creatorTasks[msg.sender].push(taskId);
        
        emit TaskCreated(taskId, msg.sender, _bounty, _metadataURI);
    }
    
    /**
     * @dev Claim an open task (requires 10% stake)
     * @param _taskId Task ID to claim
     */
    function claimTask(uint256 _taskId) external nonReentrant whenNotPaused {
        Task storage task = tasks[_taskId];
        
        if (task.status != TaskStatus.Open) revert TaskNotOpen();
        if (!agentRegistry.isRegistered(msg.sender)) revert AgentNotRegistered();
        
        uint256 requiredStake = (task.bounty * WORKER_STAKE_PERCENTAGE) / 100;
        
        // Transfer stake from worker to escrow
        bool success = usdc.transferFrom(msg.sender, address(this), requiredStake);
        if (!success) revert TransferFailed();
        
        task.worker = msg.sender;
        task.workerStake = requiredStake;
        task.status = TaskStatus.Claimed;
        task.claimedAt = block.timestamp;
        
        workerTasks[msg.sender].push(_taskId);
        
        emit TaskClaimed(_taskId, msg.sender, requiredStake);
    }
    
    /**
     * @dev Submit work for a claimed task
     * @param _taskId Task ID
     * @param _submissionURI IPFS hash containing work submission
     */
    function submitWork(uint256 _taskId, string calldata _submissionURI) 
        external 
        nonReentrant 
        whenNotPaused 
    {
        Task storage task = tasks[_taskId];
        
        if (task.status != TaskStatus.Claimed) revert TaskNotClaimed();
        if (task.worker != msg.sender) revert NotTaskWorker();
        if (bytes(_submissionURI).length == 0) revert InvalidMetadata();
        
        task.submissionURI = _submissionURI;
        task.status = TaskStatus.Submitted;
        task.submittedAt = block.timestamp;
        
        emit WorkSubmitted(_taskId, msg.sender, _submissionURI);
    }
    
    /**
     * @dev Approve submitted work (only task creator)
     * @param _taskId Task ID to approve
     */
    function approveWork(uint256 _taskId) external nonReentrant whenNotPaused {
        Task storage task = tasks[_taskId];
        
        if (task.status != TaskStatus.Submitted) revert TaskNotSubmitted();
        if (task.creator != msg.sender) revert NotTaskCreator();
        if (block.timestamp > task.submittedAt + AUTO_APPROVE_PERIOD) {
            revert AutoApprovePeriodPassed();
        }
        
        task.status = TaskStatus.Approved;
        task.creatorApproved = true;
        
        emit WorkApproved(_taskId, msg.sender, false);
        
        _distributePayment(_taskId);
    }
    
    /**
     * @dev Auto-approve work after 48 hours (anyone can call)
     * @param _taskId Task ID to auto-approve
     */
    function autoApproveWork(uint256 _taskId) external nonReentrant whenNotPaused {
        Task storage task = tasks[_taskId];
        
        if (task.status != TaskStatus.Submitted) revert TaskNotSubmitted();
        if (block.timestamp <= task.submittedAt + AUTO_APPROVE_PERIOD) {
            revert AutoApprovePeriodNotReached();
        }
        
        task.status = TaskStatus.Approved;
        task.autoApproved = true;
        
        emit WorkApproved(_taskId, address(0), true);
        
        _distributePayment(_taskId);
    }
    
    /**
     * @dev Open a dispute for a submitted task
     * @param _taskId Task ID to dispute
     * @param _reason Reason for dispute
     */
    function openDispute(uint256 _taskId, string calldata _reason) 
        external 
        nonReentrant 
        whenNotPaused 
    {
        Task storage task = tasks[_taskId];
        
        if (task.status != TaskStatus.Submitted) revert TaskNotSubmitted();
        if (task.creator != msg.sender && task.worker != msg.sender) {
            revert NotTaskCreator();
        }
        if (block.timestamp > task.submittedAt + AUTO_APPROVE_PERIOD) {
            revert AutoApprovePeriodPassed();
        }
        if (task.disputeId != 0) revert DisputeAlreadyExists();
        if (bytes(_reason).length == 0) revert InvalidMetadata();
        
        uint256 disputeId = nextDisputeId++;
        
        disputes[disputeId] = Dispute({
            id: disputeId,
            taskId: _taskId,
            initiator: msg.sender,
            reason: _reason,
            createdAt: block.timestamp,
            resolved: false,
            winner: address(0),
            resolution: ""
        });
        
        task.disputeId = disputeId;
        task.status = TaskStatus.Disputed;
        
        emit DisputeOpened(disputeId, _taskId, msg.sender, _reason);
    }
    
    /**
     * @dev Resolve a dispute (only arbitrator)
     * @param _disputeId Dispute ID to resolve
     * @param _winner Address of the winner (creator or worker)
     * @param _resolution Resolution details
     */
    function resolveDispute(
        uint256 _disputeId,
        address _winner,
        string calldata _resolution
    ) external nonReentrant onlyRole(ARBITRATOR_ROLE) {
        Dispute storage dispute = disputes[_disputeId];
        Task storage task = tasks[dispute.taskId];
        
        if (dispute.resolved) revert DisputeAlreadyResolved();
        if (_winner != task.creator && _winner != task.worker) {
            revert InvalidResolution();
        }
        
        dispute.resolved = true;
        dispute.winner = _winner;
        dispute.resolution = _resolution;
        task.status = TaskStatus.Resolved;
        
        emit DisputeResolved(_disputeId, dispute.taskId, _winner, _resolution);
        
        // Distribute based on resolution
        if (_winner == task.worker) {
            _distributePayment(dispute.taskId);
        } else {
            // Creator wins - return bounty, slash worker stake
            _returnBountyToCreator(dispute.taskId);
        }
    }
    
    /**
     * @dev Cancel an open task (only creator)
     * @param _taskId Task ID to cancel
     */
    function cancelTask(uint256 _taskId) external nonReentrant whenNotPaused {
        Task storage task = tasks[_taskId];
        
        if (task.creator != msg.sender) revert NotTaskCreator();
        if (task.status != TaskStatus.Open) revert CannotCancelClaimedTask();
        
        uint256 bounty = task.bounty;
        task.bounty = 0;
        task.status = TaskStatus.Cancelled;
        
        // Return bounty to creator
        bool success = usdc.transfer(task.creator, bounty);
        if (!success) revert TransferFailed();
        
        emit TaskCancelled(_taskId, msg.sender);
    }
    
    /**
     * @dev Internal function to distribute payment to worker
     */
    function _distributePayment(uint256 _taskId) internal {
        Task storage task = tasks[_taskId];
        
        uint256 totalAmount = task.bounty + task.workerStake;
        uint256 platformFee = (task.bounty * PLATFORM_FEE_PERCENTAGE) / 100;
        uint256 workerAmount = totalAmount - platformFee;
        
        totalFeesCollected += platformFee;
        task.bounty = 0;
        task.workerStake = 0;
        
        // Update worker reputation
        agentRegistry.recordCompletion(task.worker, _taskId, true);
        
        // Transfer payment to worker
        bool success = usdc.transfer(task.worker, workerAmount);
        if (!success) revert TransferFailed();
        
        emit PaymentDistributed(_taskId, task.worker, workerAmount, platformFee);
    }
    
    /**
     * @dev Internal function to return bounty to creator (when creator wins dispute)
     */
    function _returnBountyToCreator(uint256 _taskId) internal {
        Task storage task = tasks[_taskId];
        
        uint256 bounty = task.bounty;
        uint256 workerStake = task.workerStake;
        
        task.bounty = 0;
        task.workerStake = 0;
        
        // Update worker reputation (failed task)
        agentRegistry.recordCompletion(task.worker, _taskId, false);
        
        // Return bounty to creator
        bool success1 = usdc.transfer(task.creator, bounty);
        if (!success1) revert TransferFailed();
        
        // Worker stake goes to platform fees (slashed)
        totalFeesCollected += workerStake;
        
        emit PaymentDistributed(_taskId, address(0), 0, workerStake);
    }
    
    /**
     * @dev Withdraw accumulated platform fees (only admin)
     */
    function withdrawFees() external onlyRole(ADMIN_ROLE) {
        uint256 amount = totalFeesCollected;
        totalFeesCollected = 0;
        
        bool success = usdc.transfer(msg.sender, amount);
        if (!success) revert TransferFailed();
        
        emit FeesWithdrawn(msg.sender, amount);
    }
    
    /**
     * @dev Set USDC token address (only admin)
     */
    function setUSDC(address _usdc) external onlyRole(ADMIN_ROLE) {
        require(_usdc != address(0), "Invalid address");
        usdc = IERC20(_usdc);
    }
    
    /**
     * @dev Set AgentRegistry address (only admin)
     */
    function setAgentRegistry(address _registry) external onlyRole(ADMIN_ROLE) {
        require(_registry != address(0), "Invalid address");
        agentRegistry = AgentRegistry(_registry);
    }
    
    /**
     * @dev Pause contract (only admin)
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @dev Unpause contract (only admin)
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
    
    /**
     * @dev Get task details
     */
    function getTask(uint256 _taskId) external view returns (Task memory) {
        return tasks[_taskId];
    }
    
    /**
     * @dev Get dispute details
     */
    function getDispute(uint256 _disputeId) external view returns (Dispute memory) {
        return disputes[_disputeId];
    }
    
    /**
     * @dev Get tasks created by address
     */
    function getCreatorTasks(address _creator) external view returns (uint256[] memory) {
        return creatorTasks[_creator];
    }
    
    /**
     * @dev Get tasks worked on by address
     */
    function getWorkerTasks(address _worker) external view returns (uint256[] memory) {
        return workerTasks[_worker];
    }
    
    /**
     * @dev Check if work can be auto-approved
     */
    function canAutoApprove(uint256 _taskId) external view returns (bool) {
        Task storage task = tasks[_taskId];
        return task.status == TaskStatus.Submitted && 
               block.timestamp > task.submittedAt + AUTO_APPROVE_PERIOD;
    }
    
    /**
     * @dev Get time remaining until auto-approve
     */
    function timeUntilAutoApprove(uint256 _taskId) external view returns (uint256) {
        Task storage task = tasks[_taskId];
        if (task.status != TaskStatus.Submitted) return 0;
        
        uint256 autoApproveTime = task.submittedAt + AUTO_APPROVE_PERIOD;
        if (block.timestamp >= autoApproveTime) return 0;
        return autoApproveTime - block.timestamp;
    }
}