import argparse
import hashlib
import secrets


def main():
    parser = argparse.ArgumentParser(
        description="Buat hash password PBKDF2-SHA256 untuk kolom password/password_hash di sheet login."
    )
    parser.add_argument("password", help="Password asli yang akan di-hash.")
    parser.add_argument("--iterations", type=int, default=210000, help="Jumlah iterasi PBKDF2 (default 210000).")
    parser.add_argument("--salt", default=None, help="Salt heksadesimal (default acak).")
    args = parser.parse_args()

    salt = args.salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        args.password.encode("utf-8"),
        salt.encode("utf-8"),
        args.iterations,
    ).hex()
    print(f"pbkdf2${args.iterations}${salt}${digest}")


if __name__ == "__main__":
    main()
