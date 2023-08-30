//import type { Trophy } from "psn-api"; TrophyRarity
import {
  exchangeCodeForAccessToken,
  exchangeNpssoForCode,
  getTitleTrophies,
  getUserTitles,
  getUserTrophiesEarnedForTitle,
  makeUniversalSearch,
} from "psn-api";

module.exports(async function main() {
  // 1. Authenticate and become authorized with PSN.
  // See the Authenticating Manually docs for how to get your NPSSO.
  const accessCode = await exchangeNpssoForCode(process.env["NPSSO"]);
  const authorization = await exchangeCodeForAccessToken(accessCode);

  // 2. Get the user's `accountId` from the username.
  const allAccountsSearchResults = await makeUniversalSearch(
    authorization,
    "xelnia",
    "SocialAllAccounts"
  );

  console.log(allAccountsSearchResults);
});