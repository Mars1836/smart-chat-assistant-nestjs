path "transit/keys/content-kek" {
  capabilities = ["create", "read", "update"]
}

path "transit/datakey/plaintext/content-kek" {
  capabilities = ["update"]
}

path "transit/decrypt/content-kek" {
  capabilities = ["update"]
}
