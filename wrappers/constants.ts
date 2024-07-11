export const op_update_admin = 0x8a3447f9;
export const op_place_storage_order = 0xa8055863;
export const op_recycle_undistributed_storage_fees = 0x3c14cdbe;
export const op_register_as_storage_provider = 0x1addc0dc;
export const op_unregister_as_storage_provider = 0x401a6169;
export const op_submit_storage_proof = 0x1055bfcc;

export const error_unauthorized = 401;
export const error_not_enough_storage_fee = 1001;
export const error_duplicated_torrent_hash = 1002;
export const error_file_too_small = 1003;
export const error_file_too_large = 1004;
export const error_storage_provider_already_registered = 1005;
export const error_invalid_storage_proof = 1006;
export const error_unregistered_storage_provider = 1007;
export const error_storage_order_unexpired = 1008;
export const error_invalid_storage_provider = 1009;