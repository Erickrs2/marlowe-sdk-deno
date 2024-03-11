// deno run -A ./contracts/vesting/vesting-implementation.ts

import {
  close,
  Contract,
  datetoTimeout,
  Party,
  Timeout,
  TokenValue,
  Case,
  timeoutToDate
} from "npm:@marlowe.io/language-core-v1";
import { getPeriodInMilliseconds } from "@/contracts/vesting/utils.ts";

/**
 * Request For Creating a Vesting Marlowe Contract
 * @category Vesting Request
 */
export type VestingRequest = {
  /**
   * The party definition of the Token Provider (Role token or a Cardano Address)
   */
  provider: Party;
  /**
   * The party definition of the Token Claimer (Role token or a Cardano Address)
   */
  claimer: Party;
  /**
   * The vesting scheme definition between Token Claimer & Provider
   */
  scheme: VestingScheme;
};

/**
 * Frequency at which chunks of tokens will be released
 * @category Vesting Request
 */
export type Frequency =
  | "annually"
  | "half-yearly"
  | "quarterly"
  | "monthly"
  | "weekly"
  | "daily"
  | "hourly"
  | "by-10-minutes";

/**
 * Vesting Scheme Definition
 * @category Vesting Request
 */
export type VestingScheme = {
  /**
   * Start of the vesting schedule
   */
  start: Date;
  /**
   * Frequency at which chunks of tokens will be released
   */
  frequency: Frequency;
  /**
   * Number of Periods the Provider wants, to release the totality of the tokens to the claimer.
   */
  numberOfPeriods: bigint;
  /**
   * The token and its amount to be vested by the provider
   */
  expectedInitialDeposit: TokenValue;
};

export const mkContract = function (request: VestingRequest): Contract {
  return initialProviderDeposit(request, claimerDepositDistribution(request));
};

const initialProviderDeposit = function (
  request: VestingRequest,
  continuation: Contract,
): Contract {
  const {
    provider,
    scheme: { start, frequency, numberOfPeriods, expectedInitialDeposit },
  } = request;
  if (numberOfPeriods < 1) {
    throw "The number of periods needs to be greater or equal to 1";
  }

  const startTimeout: Timeout = datetoTimeout(start);
  const periodInMilliseconds: bigint = getPeriodInMilliseconds(frequency);
  // Provider needs to deposit before the first vesting period
  const initialDepositDeadline: Timeout = startTimeout + periodInMilliseconds;

  return {
    when: [
      {
        case: {
          party: provider,
          of_token: expectedInitialDeposit.token,
          into_account: provider,
          deposits: expectedInitialDeposit.amount,
        },
        then: continuation,
      },
    ],
    timeout_continuation: "close",
    timeout: initialDepositDeadline,
  };
};

const claimerDepositDistribution = function (
  request: VestingRequest,
): Contract {
  return recursiveClaimerDepositDistribution(request, 1n);
};

/**  NOTE: Currently this logic presents the withdrawal and cancel for the last period, even though it doesn't make sense
 *        because there is nothing to cancel, and even if the claimer does a partial withdrawal, they receive the balance in their account.
 */
export const recursiveClaimerDepositDistribution = function (
  request: VestingRequest,
  periodIndex: bigint,
): Contract {
  const {
    claimer,
    provider,
    scheme: { start, frequency, numberOfPeriods, expectedInitialDeposit },
  } = request;

  const vestingAmountPerPeriod = expectedInitialDeposit.amount /
    BigInt(numberOfPeriods);
  const startTimeout: Timeout = datetoTimeout(start);
  // Provider needs to deposit before the first vesting period
  const periodInMilliseconds = getPeriodInMilliseconds(frequency);

  const continuation: Contract = periodIndex === numberOfPeriods
    ? close
    : recursiveClaimerDepositDistribution(request, periodIndex + 1n);

  const vestingDate = startTimeout + periodIndex * periodInMilliseconds;
  const nextVestingDate = vestingDate + periodInMilliseconds;

  // On every period, we allow a claimer to do a withdrawal.
  const claimerWithdrawCase: Case = {
    case: {
      choose_between: [
        {
          from: 1n,
          to: periodIndex * vestingAmountPerPeriod,
        },
      ],
      for_choice: {
        choice_name: "withdraw",
        choice_owner: claimer,
      },
    },
    then: {
      pay: {
        value_of_choice: {
          choice_name: "withdraw",
          choice_owner: claimer,
        },
      },
      token: expectedInitialDeposit.token,
      from_account: claimer,
      to: {
        party: claimer,
      },
      then: continuation,
    },
  };

  const providerCancelCase: Case = {
    case: {
      choose_between: [
        {
          from: 1n,
          to: 1n,
        },
      ],
      for_choice: {
        choice_name: "cancel",
        choice_owner: provider,
      },
    },
    then: close,
  };

   // 1) Wait for the vesting period.
  // 2) Release vested funds
  // 3) Allow the provider to withdraw or to cancel future vesting periods
  return {
    when: [providerCancelCase],
    timeout: vestingDate,
    timeout_continuation: {
      pay: vestingAmountPerPeriod,
      token: expectedInitialDeposit.token,
      from_account: provider,
      to: {
        account: claimer,
      },
      then: {
        when:
          periodIndex === numberOfPeriods
            ? [claimerWithdrawCase]
            : [claimerWithdrawCase, providerCancelCase],
        timeout: nextVestingDate,
        timeout_continuation: continuation,
      },
    },
};
};


