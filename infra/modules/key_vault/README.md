# Module: key_vault

Creates a Standard Key Vault that uses **Azure RBAC** for authorization (no access policies).

* The vault has `prevent_destroy`, so Terraform refuses to delete it. To tear an environment down on purpose, remove that line first.
* Purge protection is on, and soft delete keeps deleted items for `soft_delete_retention_days` (7 by default). After the vault is deleted, its name stays reserved until that period ends.
* The firewall denies public traffic by default and only lets trusted Azure services and `allowed_ip_ranges` through.
* No secrets or role assignments are created yet. They are added in the slice that first needs a secret (VAPID keys for web push).

See `variables.tf` for inputs and `outputs.tf` for outputs.
