import { LiquidStakingObjectInfo } from "@suilend/springsui-sdk";

export enum LstId {
  sSUI = "sSUI",
  mSUI = "mSUI",
  ripleysSUI = "ripleysSUI",
}

export const LIQUID_STAKING_INFO_MAP: Record<LstId, LiquidStakingObjectInfo> = {
  [LstId.sSUI]: {
    id: "0x15eda7330c8f99c30e430b4d82fd7ab2af3ead4ae17046fcb224aa9bad394f6b",
    type: "0x83556891f4a0f233ce7b05cfe7f957d4020492a34f5405b2cb9377d060bef4bf::spring_sui::SPRING_SUI",
    weightHookId:
      "0xbbafcb2d7399c0846f8185da3f273ad5b26b3b35993050affa44cfa890f1f144",
  },
  [LstId.mSUI]: {
    id: "0x985dd33bc2a8b5390f2c30a18d32e9a63a993a5b52750c6fe2e6ac8baeb69f48",
    type: "0x922d15d7f55c13fd790f6e54397470ec592caa2b508df292a2e8553f3d3b274f::msui::MSUI",
    weightHookId:
      "0x887d03877df512e7ed72ca96821dc9cc1715ff7abd204d7cfa41b36a7d61d737",
  },
  [LstId.ripleysSUI]: {
    id: "0x50f983c5257f578a2340ff45f6c82f3d6fc358a3e7a8bc57dd112d280badbfd6",
    type: "0xdc0c8026236f1be172ba03d7d689bfd663497cc5a730bf367bfb2e2c72ec6df8::ripleys::RIPLEYS",
    weightHookId:
      "0xfee25aa74038036cb1548a27a6824213c6a263c3aa45dc37b1c3fbe6037be7d2",
  },
};