export const default_max_storage_providers_per_order = 30n;

export const config_min_storage_fee = 0x7bb75940;
export const config_min_storage_period_in_sec = 0x2db7cc48;
export const config_max_storage_proof_span_in_sec = 0x109258b9;
export const config_min_file_size_in_bytes = 0x657d4db3;
export const config_max_file_size_in_bytes = 0x246a7235;
export const config_treasury_fee_rate  = 0x4e57453d;
export const config_max_storage_providers_per_order = 0x72af131f;

export const op_upgrade = 0xdbfaf817;
export const op_update_admin = 0x8a3447f9;
export const op_update_treasury = 0xf33714b2;
export const op_update_storage_contract_code = 0x31c08cfa;
export const op_set_config_param = 0x761225c1;
export const op_place_storage_order = 0xa8055863;
export const op_recycle_undistributed_storage_fees = 0x3c14cdbe;
export const op_register_as_storage_provider = 0x1addc0dc;
export const op_unregister_as_storage_provider = 0x401a6169;
export const op_submit_storage_proof = 0x1055bfcc;
export const op_claim_storage_rewards = 0xd6b37a4b;

export const error_unauthorized = 401;
export const error_not_enough_storage_fee = 1001;
export const error_duplicated_torrent_hash = 1002;
export const error_file_too_small = 1003;
export const error_file_too_large = 1004;
export const error_too_short_storage_period = 1005;
export const error_storage_provider_already_registered = 1006;
export const error_invalid_storage_proof = 1007;
export const error_unregistered_storage_provider = 1008;
export const error_storage_order_unexpired = 1009;
export const error_invalid_storage_provider = 1010;