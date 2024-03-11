import { Frequency } from "@/contracts/vesting/vesting-implementation.ts";

export const getPeriodInMilliseconds = function (frequency: Frequency): bigint {
    switch (frequency) {
      case "annually":
        return 2n * getPeriodInMilliseconds("half-yearly");
      case "half-yearly":
        return 2n * getPeriodInMilliseconds("quarterly");
      case "quarterly":
        return 3n * getPeriodInMilliseconds("monthly");
      case "monthly":
        return 30n * getPeriodInMilliseconds("daily");
      case "weekly":
        return 7n * getPeriodInMilliseconds("daily");
      case "daily":
        return 24n * getPeriodInMilliseconds("hourly");
      case "hourly":
        return 1n * 60n * 60n * 1000n;
      case "by-10-minutes":
        return 2n * 60n * 1000n;
    }
  };