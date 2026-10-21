using './main.bicep'

param storageAccountName = 'stwehobbyiaasdevbicep'

param budgetAmount = 20
param budgetStartDate = '2026-10-01'

// Values that should not be committed come from environment variables.
// Set them in PowerShell before deploying (see step 17).
param adminPublicKey = readEnvironmentVariable('WEHOBBY_SSH_PUBLIC_KEY')
param budgetContactEmail = readEnvironmentVariable('WEHOBBY_BUDGET_EMAIL')