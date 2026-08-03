-- ============================================================
-- Wallet verification: the freelancer proves they hold the wallet.
-- Run once in Supabase dashboard -> SQL Editor. Safe to re-run.
-- ============================================================
--
-- The problem this solves is the one a checksum cannot: an address that is
-- perfectly valid but belongs to the wrong person. A typo is caught by the
-- address's own integrity check; a *plausible* wrong address is not.
--
-- The fix is the same one regulated crypto firms use to satisfy the Travel
-- Rule: ask the person to sign a message with the wallet they claim. Only
-- whoever holds the private key can produce that signature, so if a client
-- mistyped into someone else's valid address, the real freelancer physically
-- cannot verify it — the wrong address never turns green.
--
-- Nothing here is a secret: a signature is public by nature and proves only
-- that the holder consented to this exact sentence. No key ever leaves the
-- freelancer's wallet.

alter table contractors
  -- Null until proven. Set to the moment a valid signature was accepted.
  add column if not exists wallet_verified_at   timestamptz,
  -- The exact wallet the signature was verified against. Kept separately from
  -- `wallet` on purpose: if someone edits the roster address afterwards, the
  -- two stop matching and the badge must drop back to unverified rather than
  -- vouching for an address nobody ever signed for.
  add column if not exists verified_wallet      text,
  -- Kept as evidence. Anyone can re-check these later without trusting us.
  add column if not exists verification_message text,
  add column if not exists verification_sig     text,
  -- Single-use link the freelancer follows. Cleared once used.
  add column if not exists verify_token         uuid,
  add column if not exists verify_token_at      timestamptz;

-- Looking a contractor up by their one-time token is the hot path on the
-- public verify page, and it must not table-scan.
create unique index if not exists contractors_verify_token_idx
  on contractors (verify_token) where verify_token is not null;
