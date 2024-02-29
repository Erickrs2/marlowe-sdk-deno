//deno run -A ./contracts/playground/playground-template.ts

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
import * as O from "fp-ts/lib/Option.js";
import { pipe } from "fp-ts/lib/function.js";

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

  console.log(contract.when[0].case)
