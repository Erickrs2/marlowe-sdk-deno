//deno run -A ./contracts/playground/playground-template.ts
//deno doc --html --name="Playground" ./contracts/playground/playground-template.ts
// deno-lint-ignore-file

import {
  Case,
  close,
  Contract,
  datetoTimeout,
  Environment,
  IChoice,
  Input,
  MarloweState,
  mkEnvironment,
  Party,
  Timeout,
  timeoutToDate,
  TokenValue,
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
 * Initialize Contract Playground.
 * @param {number} x
 * @param {number} y
 * @returns {Contract} Contract
 */
export function mkContract (x: number, y: number): Contract {
  const contract: Contract = {
    when: [
      {
        then: {
          when: [
            {
              then: "close",
              case: {
                for_choice: {
                  choice_owner: { address: "provider" },
                  choice_name: "cancel",
                },
                choose_between: [{ to: 0, from: 0 }],
              },
            },
          ],
          timeout_continuation: {
            when: [
              {
                then: {
                  token: { token_name: "", currency_symbol: "" },
                  to: { account: { address: "withdraw" } },
                  then: "close",
                  pay: 5000000,
                  from_account: { address: "provider" },
                },
                case: {
                  for_choice: {
                    choice_owner: { address: "withdraw" },
                    choice_name: "withdraw",
                  },
                  choose_between: [{ to: 0, from: 0 }],
                },
              },
              {
                then: "close",
                case: {
                  for_choice: {
                    choice_owner: { address: "provider" },
                    choice_name: "cancel2",
                  },
                  choose_between: [{ to: 1, from: 1 }],
                },
              },
            ],
            timeout_continuation: "close",
            timeout: 1709249184696,
          },
          timeout: 1709247384696,
        },
        case: {
          party: { address: "provider" },
          of_token: { token_name: "", currency_symbol: "" },
          into_account: { address: "provider" },
          deposits: 5000000,
        },
      },
    ],
    timeout_continuation: "close",
    timeout: 1709250984696,
  };

  return contract
}


