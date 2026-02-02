// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title AgentRegistry
 * @dev Agent identity and reputation contract for AI Agent Marketplace
 * - Register agents with public keys
 * - Track reputation scores on-chain
 * - Store skill verification records
 */
contract AgentRegistry is AccessControl, Pausable {
    
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    // Agent identity structure
    struct Agent {
        address agentAddress;
        string publicKey; // PGP or other public key for encryption
        string metadataURI; // IPFS hash with agent profile
        uint256 registeredAt;
        bool isActive;
        uint256 reputationScore; // 0-10000 (100.00%)
        uint256 totalTasksCompleted;
        uint256 totalTasksFailed;
        uint256 totalEarnings;
    }
    
    // Skill verification structure
    struct Skill {
        string name;
        string category;
        uint256 verifiedAt;
        address verifier;
        string verificationProof; // IPFS hash or certificate
        uint256 level; // 1-5 skill level
        bool isActive;
    }
    
    // Reputation change record
    struct ReputationRecord {
        uint256 timestamp;
        int256 change; // positive or negative change
        string reason;
        uint256 taskId;
    }
    
    // State variables
    mapping(address => Agent) public agents;
    mapping(address => bool) public isRegistered;
    mapping(address => mapping(bytes32 => Skill)) public skills; // agent => skill hash => skill
    mapping(address => bytes32[]) public agentSkills; // agent => list of skill hashes
    mapping(address => ReputationRecord[]) public reputationHistory;
    
    address[] public allAgents;
    
    // Reputation parameters
    uint256 public constant MAX_REPUTATION = 10000;
    uint256 public constant REPUTATION_BASE = 5000; // Starting reputation (50.00%)
    uint256 public constant COMPLETION_BONUS = 100; // +1.00% per completion
    uint256 public constant FAILURE_PENALTY = 200; // -2.00% per failure
    uint256 public constant MAX_FAILURE_PENALTY = 2000; // Max -20.00% per failure
    
    // Events
    event AgentRegistered(
        address indexed agentAddress,
        string publicKey,
        string metadataURI
    );
    
    event AgentUpdated(
        address indexed agentAddress,
        string publicKey,
        string metadataURI
    );
    
    event AgentDeactivated(address indexed agentAddress);
    
    event AgentReactivated(address indexed agentAddress);
    
    event SkillAdded(
        address indexed agentAddress,
        bytes32 indexed skillHash,
        string name,
        string category,
        uint256 level
    );
    
    event SkillVerified(
        address indexed agentAddress,
        bytes32 indexed skillHash,
        address indexed verifier,
        string verificationProof
    );
    
    event SkillRemoved(
        address indexed agentAddress,
        bytes32 indexed skillHash
    );
    
    event ReputationUpdated(
        address indexed agentAddress,
        uint256 newScore,
        int256 change,
        string reason
    );
    
    event TaskCompletionRecorded(
        address indexed agentAddress,
        uint256 indexed taskId,
        bool success
    );
    
    // Errors
    error AlreadyRegistered();
    error NotRegistered();
    error InvalidPublicKey();
    error InvalidMetadata();
    error SkillAlreadyExists();
    error SkillNotFound();
    error InvalidSkillLevel();
    error CannotSelfVerify();
    error InvalidAddress();
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender);
    }
    
    /**
     * @dev Register a new agent
     * @param _publicKey Public key for encrypted communication
     * @param _metadataURI IPFS hash with agent profile details
     */
    function registerAgent(
        string calldata _publicKey,
        string calldata _metadataURI
    ) external whenNotPaused {
        if (isRegistered[msg.sender]) revert AlreadyRegistered();
        if (bytes(_publicKey).length == 0) revert InvalidPublicKey();
        if (bytes(_metadataURI).length == 0) revert InvalidMetadata();
        
        agents[msg.sender] = Agent({
            agentAddress: msg.sender,
            publicKey: _publicKey,
            metadataURI: _metadataURI,
            registeredAt: block.timestamp,
            isActive: true,
            reputationScore: REPUTATION_BASE,
            totalTasksCompleted: 0,
            totalTasksFailed: 0,
            totalEarnings: 0
        });
        
        isRegistered[msg.sender] = true;
        allAgents.push(msg.sender);
        
        emit AgentRegistered(msg.sender, _publicKey, _metadataURI);
    }
    
    /**
     * @dev Update agent profile
     * @param _publicKey New public key
     * @param _metadataURI New metadata URI
     */
    function updateAgent(
        string calldata _publicKey,
        string calldata _metadataURI
    ) external whenNotPaused {
        if (!isRegistered[msg.sender]) revert NotRegistered();
        if (bytes(_publicKey).length == 0) revert InvalidPublicKey();
        if (bytes(_metadataURI).length == 0) revert InvalidMetadata();
        
        Agent storage agent = agents[msg.sender];
        agent.publicKey = _publicKey;
        agent.metadataURI = _metadataURI;
        
        emit AgentUpdated(msg.sender, _publicKey, _metadataURI);
    }
    
    /**
     * @dev Deactivate agent account
     */
    function deactivateAgent() external {
        if (!isRegistered[msg.sender]) revert NotRegistered();
        
        agents[msg.sender].isActive = false;
        
        emit AgentDeactivated(msg.sender);
    }
    
    /**
     * @dev Reactivate agent account
     */
    function reactivateAgent() external whenNotPaused {
        if (!isRegistered[msg.sender]) revert NotRegistered();
        
        agents[msg.sender].isActive = true;
        
        emit AgentReactivated(msg.sender);
    }
    
    /**
     * @dev Add a skill to agent profile
     * @param _name Skill name
     * @param _category Skill category
     * @param _level Skill level (1-5)
     */
    function addSkill(
        string calldata _name,
        string calldata _category,
        uint256 _level
    ) external whenNotPaused {
        if (!isRegistered[msg.sender]) revert NotRegistered();
        if (_level < 1 || _level > 5) revert InvalidSkillLevel();
        
        bytes32 skillHash = keccak256(abi.encodePacked(_name, _category));
        
        if (skills[msg.sender][skillHash].verifiedAt != 0) {
            revert SkillAlreadyExists();
        }
        
        skills[msg.sender][skillHash] = Skill({
            name: _name,
            category: _category,
            verifiedAt: 0,
            verifier: address(0),
            verificationProof: "",
            level: _level,
            isActive: true
        });
        
        agentSkills[msg.sender].push(skillHash);
        
        emit SkillAdded(msg.sender, skillHash, _name, _category, _level);
    }
    
    /**
     * @dev Verify an agent's skill (only verifier role)
     * @param _agent Address of agent to verify
     * @param _skillHash Hash of the skill to verify
     * @param _verificationProof IPFS hash or certificate
     */
    function verifySkill(
        address _agent,
        bytes32 _skillHash,
        string calldata _verificationProof
    ) external onlyRole(VERIFIER_ROLE) whenNotPaused {
        if (!isRegistered[_agent]) revert NotRegistered();
        if (_agent == msg.sender) revert CannotSelfVerify();
        if (bytes(_verificationProof).length == 0) revert InvalidMetadata();
        
        Skill storage skill = skills[_agent][_skillHash];
        if (skill.verifiedAt != 0 && skill.verifier != address(0)) {
            revert SkillAlreadyExists();
        }
        
        skill.verifiedAt = block.timestamp;
        skill.verifier = msg.sender;
        skill.verificationProof = _verificationProof;
        
        // Bonus reputation for verified skill
        _updateReputation(_agent, 50, "Skill verified", 0);
        
        emit SkillVerified(_agent, _skillHash, msg.sender, _verificationProof);
    }
    
    /**
     * @dev Remove a skill from agent profile
     * @param _skillHash Hash of the skill to remove
     */
    function removeSkill(bytes32 _skillHash) external {
        if (!isRegistered[msg.sender]) revert NotRegistered();
        if (skills[msg.sender][_skillHash].verifiedAt == 0) {
            revert SkillNotFound();
        }
        
        skills[msg.sender][_skillHash].isActive = false;
        
        emit SkillRemoved(msg.sender, _skillHash);
    }
    
    /**
     * @dev Record task completion for reputation (called by AgentEscrow)
     * @param _agent Address of the agent
     * @param _taskId Task ID
     * @param _success Whether the task was completed successfully
     */
    function recordCompletion(
        address _agent,
        uint256 _taskId,
        bool _success
    ) external whenNotPaused {
        if (!isRegistered[_agent]) revert NotRegistered();
        
        Agent storage agent = agents[_agent];
        
        if (_success) {
            agent.totalTasksCompleted++;
            _updateReputation(_agent, int256(COMPLETION_BONUS), "Task completed successfully", _taskId);
        } else {
            agent.totalTasksFailed++;
            int256 penalty = -int256(FAILURE_PENALTY);
            // Cap the penalty
            if (agent.reputationScore < FAILURE_PENALTY) {
                penalty = -int256(agent.reputationScore);
            }
            _updateReputation(_agent, penalty, "Task failed or disputed", _taskId);
        }
        
        emit TaskCompletionRecorded(_agent, _taskId, _success);
    }
    
    /**
     * @dev Update agent earnings (called by AgentEscrow)
     * @param _agent Address of the agent
     * @param _amount Amount earned
     */
    function recordEarnings(address _agent, uint256 _amount) external {
        if (!isRegistered[_agent]) revert NotRegistered();
        agents[_agent].totalEarnings += _amount;
    }
    
    /**
     * @dev Internal function to update reputation
     */
    function _updateReputation(
        address _agent,
        int256 _change,
        string memory _reason,
        uint256 _taskId
    ) internal {
        Agent storage agent = agents[_agent];
        
        uint256 oldScore = agent.reputationScore;
        
        if (_change > 0) {
            agent.reputationScore = uint256(
                min(int256(oldScore) + _change, int256(MAX_REPUTATION))
            );
        } else {
            uint256 decrease = uint256(-_change);
            agent.reputationScore = oldScore > decrease ? oldScore - decrease : 0;
        }
        
        reputationHistory[_agent].push(ReputationRecord({
            timestamp: block.timestamp,
            change: _change,
            reason: _reason,
            taskId: _taskId
        }));
        
        emit ReputationUpdated(_agent, agent.reputationScore, _change, _reason);
    }
    
    /**
     * @dev Admin function to manually adjust reputation
     */
    function adjustReputation(
        address _agent,
        int256 _change,
        string calldata _reason
    ) external onlyRole(ADMIN_ROLE) {
        if (!isRegistered[_agent]) revert NotRegistered();
        _updateReputation(_agent, _change, _reason, 0);
    }
    
    /**
     * @dev Get agent details
     */
    function getAgent(address _agent) external view returns (Agent memory) {
        return agents[_agent];
    }
    
    /**
     * @dev Get agent skills
     */
    function getAgentSkills(address _agent) external view returns (bytes32[] memory) {
        return agentSkills[_agent];
    }
    
    /**
     * @dev Get skill details
     */
    function getSkill(address _agent, bytes32 _skillHash) 
        external 
        view 
        returns (Skill memory) 
    {
        return skills[_agent][_skillHash];
    }
    
    /**
     * @dev Get reputation history
     */
    function getReputationHistory(address _agent) 
        external 
        view 
        returns (ReputationRecord[] memory) 
    {
        return reputationHistory[_agent];
    }
    
    /**
     * @dev Check if agent has specific skill
     */
    function hasSkill(
        address _agent,
        string calldata _name,
        string calldata _category
    ) external view returns (bool) {
        bytes32 skillHash = keccak256(abi.encodePacked(_name, _category));
        return skills[_agent][skillHash].isActive;
    }
    
    /**
     * @dev Get all registered agents count
     */
    function getAgentCount() external view returns (uint256) {
        return allAgents.length;
    }
    
    /**
     * @dev Get agents by page (pagination)
     */
    function getAgentsByPage(uint256 _page, uint256 _pageSize) 
        external 
        view 
        returns (address[] memory) 
    {
        uint256 start = _page * _pageSize;
        if (start >= allAgents.length) return new address[](0);
        
        uint256 end = start + _pageSize;
        if (end > allAgents.length) end = allAgents.length;
        
        address[] memory result = new address[](end - start);
        for (uint256 i = start; i < end; i++) {
            result[i - start] = allAgents[i];
        }
        return result;
    }
    
    /**
     * @dev Get reputation percentage (0-100)
     */
    function getReputationPercentage(address _agent) external view returns (uint256) {
        return agents[_agent].reputationScore / 100;
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
     * @dev min helper
     */
    function min(int256 a, int256 b) internal pure returns (int256) {
        return a < b ? a : b;
    }
}