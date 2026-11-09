import { expect } from "chai";
import { network } from "hardhat";

describe("DisasterCrowdfunding Smart Contract", function () {
  async function deployFixture() {
    // Hubungkan ke jaringan lokal aktif untuk mendapatkan provider & ethers instance
    const { ethers } = await network.connect();

    const [owner, relayer, inisiator, donor, campaignWallet, unauthorizedUser] =
      await ethers.getSigners();

    const DisasterCrowdfunding = await ethers.getContractFactory("DisasterCrowdfunding");
    const contract = await DisasterCrowdfunding.deploy(relayer.address);
    await contract.waitForDeployment();

    return {
      contract,
      ethers,
      owner,
      relayer,
      inisiator,
      donor,
      campaignWallet,
      unauthorizedUser,
    };
  }

  describe("1. Pembuatan Kampanye Bencana (createCampaign)", function () {
    it("Harus berhasil membuat kampanye baru jika dipanggil oleh relayer", async function () {
      const { contract, relayer, inisiator, campaignWallet } = await deployFixture();
      const targetDana = 50_000_000n; // Rp 50.000.000

      await expect(
        contract
          .connect(relayer)
          .createCampaign("Bantuan Banjir Lahar Dingin", inisiator.address, campaignWallet.address, targetDana)
      )
        .to.emit(contract, "CampaignCreated")
        .withArgs(1n, "Bantuan Banjir Lahar Dingin", inisiator.address, campaignWallet.address, targetDana);

      const campaign = await contract.campaigns(1n);
      expect(campaign.id).to.equal(1n);
      expect(campaign.title).to.equal("Bantuan Banjir Lahar Dingin");
      expect(campaign.targetDana).to.equal(targetDana);
      expect(campaign.danaTerkumpul).to.equal(0n);
      expect(campaign.isActive).to.be.true;
    });

    it("Harus gagal jika entitas selain relayer atau owner memanggil createCampaign", async function () {
      const { contract, unauthorizedUser, inisiator, campaignWallet } = await deployFixture();

      await expect(
        contract
          .connect(unauthorizedUser)
          .createCampaign("Kampanye Palsu", inisiator.address, campaignWallet.address, 10_000_000n)
      ).to.be.revertedWith("Akses ditolak: Bukan relayer atau owner");
    });
  });

  describe("2. Pencatatan Donasi (donateToCampaign)", function () {
    it("Harus mencatat akumulasi saldo donasi dan memancarkan event audit trail", async function () {
      const { contract, relayer, inisiator, donor, campaignWallet } = await deployFixture();
      
      await contract
        .connect(relayer)
        .createCampaign("Bencana Gempa", inisiator.address, campaignWallet.address, 100_000_000n);

      const nominalDonasi = 250_000n; // Rp 250.000
      const orderIdMidtrans = "MIDTRANS-TRX-001";

      await expect(
        contract
          .connect(relayer)
          .donateToCampaign(1n, donor.address, nominalDonasi, orderIdMidtrans)
      )
        .to.emit(contract, "DonationReceived");

      const campaign = await contract.campaigns(1n);
      expect(campaign.danaTerkumpul).to.equal(nominalDonasi);
    });
  });

  describe("3. Pencairan Dana (withdrawDisbursement)", function () {
    it("Inisiator yang sah berhasil mencairkan dana dengan tautan bukti fisik", async function () {
      const { contract, relayer, inisiator, donor, campaignWallet } = await deployFixture();

      await contract
        .connect(relayer)
        .createCampaign("Bencana Erupsi", inisiator.address, campaignWallet.address, 10_000_000n);
      
      await contract
        .connect(relayer)
        .donateToCampaign(1n, donor.address, 2_000_000n, "ORDER-ERUPSI-01");

      const nominalPencairan = 500_000n;
      const buktiFisikUri = "https://ipfs.io/ipfs/QmContohHashBuktiKwitansiLogistik";

      await expect(
        contract
          .connect(inisiator)
          .withdrawDisbursement(1n, nominalPencairan, buktiFisikUri)
      ).to.emit(contract, "DisbursementExecuted");

      const campaign = await contract.campaigns(1n);
      expect(campaign.danaDicairkan).to.equal(nominalPencairan);

      const disbursements = await contract.getDisbursements(1n);
      expect(disbursements.length).to.equal(1);
      expect(disbursements[0].evidenceUri).to.equal(buktiFisikUri);
      expect(disbursements[0].amount).to.equal(nominalPencairan);
    });

    it("Harus gagal jika pihak selain inisiator mencoba mencairkan dana", async function () {
      const { contract, relayer, inisiator, donor, campaignWallet, unauthorizedUser } = await deployFixture();

      await contract
        .connect(relayer)
        .createCampaign("Bencana Banjir", inisiator.address, campaignWallet.address, 10_000_000n);
      await contract
        .connect(relayer)
        .donateToCampaign(1n, donor.address, 1_000_000n, "ORDER-BANJIR-01");

      await expect(
        contract
          .connect(unauthorizedUser)
          .withdrawDisbursement(1n, 500_000n, "https://link-palsu.com")
      ).to.be.revertedWith("Akses ditolak: Bukan inisiator kampanye");
    });

    it("Harus gagal jika nominal pencairan melebihi sisa saldo kampanye", async function () {
      const { contract, relayer, inisiator, donor, campaignWallet } = await deployFixture();

      await contract
        .connect(relayer)
        .createCampaign("Bencana Banjir", inisiator.address, campaignWallet.address, 10_000_000n);
      await contract
        .connect(relayer)
        .donateToCampaign(1n, donor.address, 500_000n, "ORDER-BANJIR-02");

      await expect(
        contract
          .connect(inisiator)
          .withdrawDisbursement(1n, 1_000_000n, "https://link-bukti.com")
      ).to.be.revertedWith("Saldo kampanye tidak mencukupi");
    });
  });
});
