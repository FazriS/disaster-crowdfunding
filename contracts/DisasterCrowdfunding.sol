// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title DisasterCrowdfunding
 * @notice Smart contract transparansi penggalangan dana bencana berbasis hibrida fiat-blockchain
 */
contract DisasterCrowdfunding is Ownable, ReentrancyGuard {
    
    struct Campaign {
        uint256 id;
        string title;
        address inisiator;
        address campaignWallet;
        uint256 targetDana;        // Target donasi (denominasi Rupiah)
        uint256 danaTerkumpul;     // Total donasi masuk
        uint256 danaDicairkan;     // Total donasi yang dicairkan
        bool isActive;
    }

    struct Disbursement {
        uint256 campaignId;
        uint256 amount;
        string evidenceUri;       // URI/URL bukti fisik penyaluran logistik bencana
        uint256 timestamp;
    }

    uint256 public campaignCount;
    address public backendRelayer; // Alamat server backend yang memproses webhook Midtrans

    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => Disbursement[]) public campaignDisbursements;

    // Events untuk audit trail Sepolia Etherscan
    event CampaignCreated(
        uint256 indexed campaignId, 
        string title, 
        address indexed inisiator, 
        address indexed campaignWallet, 
        uint256 targetDana
    );

    event DonationReceived(
        uint256 indexed campaignId, 
        address indexed donorWallet, 
        uint256 amount, 
        string midtransOrderId, 
        uint256 timestamp
    );

    event DisbursementExecuted(
        uint256 indexed campaignId, 
        address indexed inisiator, 
        uint256 amount, 
        string evidenceUri, 
        uint256 timestamp
    );

    modifier onlyRelayerOrOwner() {
        require(_msgSender() == backendRelayer || _msgSender() == owner(), "Akses ditolak: Bukan relayer atau owner");
        _;
    }

    modifier onlyCampaignInitiator(uint256 _campaignId) {
        require(campaigns[_campaignId].inisiator == _msgSender(), "Akses ditolak: Bukan inisiator kampanye");
        _;
    }

    constructor(address _initialRelayer) Ownable(msg.sender) {
        require(_initialRelayer != address(0), "Alamat relayer tidak valid");
        backendRelayer = _initialRelayer;
    }

    function setBackendRelayer(address _newRelayer) external onlyOwner {
        require(_newRelayer != address(0), "Alamat relayer tidak valid");
        backendRelayer = _newRelayer;
    }

    /**
     * @notice Pendaftaran kampanye bencana baru setelah verifikasi dokumen legalitas off-chain
     */
    function createCampaign(
        string memory _title,
        address _inisiator,
        address _campaignWallet,
        uint256 _targetDana
    ) external onlyRelayerOrOwner returns (uint256) {
        require(_inisiator != address(0), "Alamat inisiator tidak valid");
        require(_campaignWallet != address(0), "Alamat wallet kampanye tidak valid");
        require(_targetDana > 0, "Target dana harus lebih dari 0");

        campaignCount++;
        campaigns[campaignCount] = Campaign({
            id: campaignCount,
            title: _title,
            inisiator: _inisiator,
            campaignWallet: _campaignWallet,
            targetDana: _targetDana,
            danaTerkumpul: 0,
            danaDicairkan: 0,
            isActive: true
        });

        emit CampaignCreated(campaignCount, _title, _inisiator, _campaignWallet, _targetDana);
        return campaignCount;
    }

    /**
     * @notice Pencatatan transaksi donasi masuk yang dipicu oleh backend relayer setelah settlement Midtrans
     */
    function donateToCampaign(
        uint256 _campaignId,
        address _donorWallet,
        uint256 _amount,
        string memory _midtransOrderId
    ) external onlyRelayerOrOwner nonReentrant {
        Campaign storage campaign = campaigns[_campaignId];
        require(campaign.isActive, "Kampanye tidak aktif");
        require(_amount > 0, "Nominal donasi harus lebih dari 0");

        campaign.danaTerkumpul += _amount;

        emit DonationReceived(_campaignId, _donorWallet, _amount, _midtransOrderId, block.timestamp);
    }

    /**
     * @notice Pencairan dana kampanye dengan rekaman bukti fisik penyaluran
     */
    function withdrawDisbursement(
        uint256 _campaignId,
        uint256 _amount,
        string memory _evidenceUri
    ) external onlyCampaignInitiator(_campaignId) nonReentrant {
        Campaign storage campaign = campaigns[_campaignId];
        require(campaign.isActive, "Kampanye tidak aktif");
        require(_amount > 0, "Nominal pencairan harus lebih dari 0");
        
        uint256 availableBalance = campaign.danaTerkumpul - campaign.danaDicairkan;
        require(_amount <= availableBalance, "Saldo kampanye tidak mencukupi");

        campaign.danaDicairkan += _amount;

        campaignDisbursements[_campaignId].push(Disbursement({
            campaignId: _campaignId,
            amount: _amount,
            evidenceUri: _evidenceUri,
            timestamp: block.timestamp
        }));

        emit DisbursementExecuted(_campaignId, msg.sender, _amount, _evidenceUri, block.timestamp);
    }

    /**
     * @notice Menutup status keaktifan kampanye bencana
     */
    function closeCampaign(uint256 _campaignId) external onlyCampaignInitiator(_campaignId) {
        campaigns[_campaignId].isActive = false;
    }

    /**
     * @notice Mengambil daftar riwayat pencairan dana kampanye bencana
     */
    function getDisbursements(uint256 _campaignId) external view returns (Disbursement[] memory) {
        return campaignDisbursements[_campaignId];
    }
}
