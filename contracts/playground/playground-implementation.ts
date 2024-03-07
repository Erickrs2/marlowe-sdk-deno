//deno run -A ./contracts/playground/playground-implementation.ts
//deno doc --html --name="Playground" ./contracts/playground/playground-implementation.ts
// deno-lint-ignore-file

import {
  Case,
  close,
  Contract,
  datetoTimeout,
  Environment,
  IChoice,
  Input,
  lovelace,
  MarloweState,
  mkEnvironment,
  Party,
  Timeout,
  timeoutToDate,
  TokenValue,
  Value,
} from "npm:@marlowe.io/language-core-v1";

import {
  Choice,
  Deposit,
  emptyApplicables,
  Next,
} from "npm:@marlowe.io/language-core-v1/next";
import * as G from "@marlowe.io/language-core-v1/guards";
import * as fpTs from "https://deno.land/x/fp_ts@v2.11.4/mod.ts";
import * as O from "https://deno.land/x/fp_ts@v2.11.4/Option.ts";

/**
 * Contract request object
 * @category Vesting Request
 */
export interface VestingRequest {
  /**
   * The party definition of the Token Provider (Role token or a Cardano * Address)
   */
  provider: Party;
  /**
   * The party definition of the Token Provider (Role token or a Cardano * Address)
   */
  claimer: Party;
  /**
   * Vesting Scheme
   */
  scheme: VestingScheme;
}

/**
 * Contract request object
 * @category Vesting Request
 */
export interface VestingScheme {
  /**
   * Last day that the provider can deposit)
   */
  startTimeout: Date;
  /**
   * amount the provider will deposit)
   */
  amount: Value;
}

/**
 * Function to initialize the playground contract
 * @param {request} VestingRequest
 * @returns {Contract}
 * @category Vesting Contract Generation
 */
export function mkContract(
  request: VestingRequest,
): Contract {
  const startLimit = datetoTimeout(request.scheme.startTimeout);
  const vestingDate = startLimit + (1n * 60n * 60n * 1000n);
  const expirationDate = vestingDate + (1n * 60n * 60n * 1000n);

  const contract: Contract = {
    when: [
      {
        then: {
          when: [
            {
              then: close,
              case: {
                for_choice: {
                  choice_owner: request.provider,
                  choice_name: "cancel",
                },
                choose_between: [{ to: 0n, from: 0n }],
              },
            },
          ],
          timeout_continuation: {
            when: [
              {
                then: {
                  token: lovelace,
                  to: { account: request.claimer },
                  then: "close",
                  pay: request.scheme.amount,
                  from_account: request.provider,
                },
                case: {
                  for_choice: {
                    choice_owner: request.claimer,
                    choice_name: "withdraw",
                  },
                  choose_between: [{ to: 0n, from: 0n }],
                },
              },
              {
                then: close,
                case: {
                  for_choice: {
                    choice_owner: request.provider,
                    choice_name: "cancel",
                  },
                  choose_between: [{ to: 1n, from: 1n }],
                },
              },
            ],
            timeout_continuation: close,
            timeout: expirationDate,
          },
          timeout: vestingDate,
        },
        case: {
          party: request.provider,
          of_token: lovelace,
          into_account: request.claimer,
          deposits: request.scheme.amount,
        },
      },
    ],
    timeout_continuation: close,
    timeout: startLimit,
  };

  return contract;
}

export type VestingState = Closed | NoDepositBeforeDeadline | VestingEnded | WaitingDepositByProvider | undefined;

/**
 *  where The contract has been created. But no inputs has been applied yet.
 * Inputs are predefined, as a user of this contract, you don't need to create these inputs yourself.
 * You can provide this input directly to `applyInputs` on the `ContractLifeCycleAPI` :
 * 1. `depositInput` is availaible if the connected wallet is the Provider.
 */
export type WaitingDepositByProvider = {
  name: "WaitingDepositByProvider";
  scheme: VestingScheme;
  initialDepositDeadline: Date;
  depositInput?: Input[];
};

/**
 * where the Initial Deposit deadline has passed.
 * It supposed to be given by the Provider and is a prerequesite to
 * continue the contract logic. *
 */
export type NoDepositBeforeDeadline = {
  name: "NoDepositBeforeDeadline";
  scheme: VestingScheme;
  initialDepositDeadline: Date;
  payMinUtxoBackInput: Input[];
};

/**
 * where the contract has passed all its vesting periods
 * Inputs are predefined, as a user of this contract, you don't need to create these inputs yourself.
 * You can provide this input directly to `applyInputs` on the `ContractLifeCycleAPI` :
 *  - `withdrawInput` is availaible if the connected wallet is the Claimer.
 */
export type VestingEnded = {
  name: "VestingEnded";
  scheme: VestingScheme;
  quantities: Value;
  withdrawInput?: Input[];
};

export type Closed = {
  name: "Closed";
  scheme: VestingScheme;
  closeCondition: CloseCondition;
};

export type CloseCondition =
  | DepositDeadlineCloseCondition
  | CancelledCloseCondition
  | ClaimedCloseCondition
  | UnknownCloseCondition;

/**
 * the contract is closed because the provider didn't provide the deposit
 * before the deadline.
 */
export type DepositDeadlineCloseCondition = {
  name: "DepositDeadlineCloseCondition";
};

/**
 * the contract is closed because the provider has cancelled the token plan
 * before the end.
 */
export type CancelledCloseCondition = {
  name: "CancelledCloseCondition";
};

/**
 * the contract is closed because the claimer has fully withdrawn the tokens from the
 * plan (happy path).
 */
export type ClaimedCloseCondition = { name: "ClaimedCloseCondition" };

/**
 *  the contract is closed but in an unexpected manner
 */
export type UnknownCloseCondition = {
  name: "UnknownCloseCondition";
  inputHistory: Input[];
};

export const getVestingState = async (
  scheme: VestingScheme,
  state: MarloweState,
  inputHistory: Input[],
  getNext: (environment: Environment) => Promise<Next>,
): Promise<VestingState> => {
  if (state === undefined) {
    if (inputHistory.length === 0) {
      // Deadline has passed and there is one reduced applied to close the contract
      return {
        name: "Closed",
        scheme: scheme,
        closeCondition: { name: "DepositDeadlineCloseCondition" },
      };
    }
    const isClaimed = 1 ===
      inputHistory
        .filter((input) => G.IChoice.is(input))
        .map((input) => input as IChoice)
        .filter((choice) => choice.for_choice_id.choice_name === "withdraw")
        .length;
    if (isClaimed) {
      return {
        name: "Closed",
        scheme: scheme,
        closeCondition: { name: "ClaimedCloseCondition" },
      };
    }
    const isCancelled = 1 ===
      inputHistory
        .filter((input) => G.IChoice.is(input))
        .map((input) => input as IChoice)
        .filter((choice) => choice.for_choice_id.choice_name === "cancel")
        .length;

    if (isCancelled) {
      return {
        name: "Closed",
        scheme: scheme,
        closeCondition: {
          name: "CancelledCloseCondition",
        },
      };
    }

    return {
      name: "Closed",
      scheme: scheme,
      closeCondition: {
        name: "UnknownCloseCondition",
        inputHistory: inputHistory,
      },
    };
  }

  const startTimeout: Timeout = datetoTimeout(new Date(scheme.startTimeout));
  const periodInMilliseconds: bigint = 1n * 60n * 60n * 1000n;

  // Provider needs to deposit before the first vesting period
  const initialDepositDeadline: Timeout = startTimeout;
  const now = datetoTimeout(new Date());
  const periodInterval: [Date, Date] = [
    timeoutToDate(startTimeout - periodInMilliseconds + 1n),
    timeoutToDate(
      startTimeout - 1n,
    ),
  ];

  const environment = mkEnvironment(periodInterval[0])(periodInterval[1]);
  const next = await getNext(environment);

  if (
    // Passed the deadline, can reduce , deposit == min utxo
    now > initialDepositDeadline &&
    next.can_reduce &&
    emptyApplicables(next) &&
    state?.accounts.length === 1 &&
    state?.accounts[0][1] <= 3_000_000n // min utxo
  ) {
    return {
      name: "NoDepositBeforeDeadline",
      scheme: scheme,
      initialDepositDeadline: timeoutToDate(initialDepositDeadline),
      payMinUtxoBackInput: [],
    };
  }

  if (
    // can reduce, periods have passed.
    next.can_reduce &&
    emptyApplicables(next)
  )
    return {
      name: "VestingEnded",
      quantities: scheme.amount,
      scheme: scheme,
      withdrawInput: [],
    };

   // Initial Deposit Phase
   if (
    // before deposit deadline and deposit < initial deposit
    state?.accounts.length == 1 &&
    now < initialDepositDeadline    
  ) {
    const depositInput =
      next.applicable_inputs.deposits.length == 1
        ? [Deposit.toInput(next.applicable_inputs.deposits[0])]
        : undefined;
    return {
      name: "WaitingDepositByProvider",
      scheme: scheme,
      initialDepositDeadline: timeoutToDate(initialDepositDeadline),
      depositInput: depositInput,
    };
  }  
};
