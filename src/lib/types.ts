export type ProfitEntry = {
  id: number
  entryDate: string
  amountUsd: number
  source: string
  note: string
  createdAt: string
}

export type GoalSettings = {
  year: number
  annualTargetUsd: number
  monthlyTargetUsd: number
}

export type TeslaProgress = {
  currentUsd: number
  targetUsd: number
  progress: number
}
