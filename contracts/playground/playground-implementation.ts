//deno run -A ./contracts/playground/playground-template.ts
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
import * as G from "npm:@marlowe.io/language-core-v1/guards";
import * as O from "npm:fp-ts/Option";
import { pipe } from "npm:fp-ts/function";

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
  const start = datetoTimeout(request.scheme.startTimeout);
  const vestingDate = start + (1n * 60n * 60n * 1000n);
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
                    choice_name: "cancel2",
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
    timeout: start,
  };

  return contract;
}
