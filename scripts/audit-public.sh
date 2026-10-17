#!/usr/bin/env bash
# Audit a repository for confidential data before it reaches a public remote.
# Scans the working tree, the full history and the commit messages. Exits 1
# when anything needs attention.
#
# Sensitive terms are read from, when present:
#   - $PUBLICATION_TERMS (default: ~/.config/opencode/sensitive-terms.local)
#   - scripts/private-ids.local (repository-local, git-ignored)
# One literal term per line; blank lines and #-comments are ignored.
usage() { echo "usage: $0 [repo-dir] [--zip path/to/artifact.zip]" >&2; exit 2; }

repo=$PWD
zip=
while [ $# -gt 0 ]; do
    case $1 in
        --zip) [ $# -ge 2 ] || usage; zip=$2; shift 2;;
        -*) usage;;
        *) repo=$1; shift;;
    esac
done
cd "$repo" 2>/dev/null || { echo "no such directory: $repo" >&2; exit 2; }
git rev-parse --git-dir >/dev/null 2>&1 || { echo "not a git repository: $repo" >&2; exit 2; }

findings=0
flag() { findings=$((findings + 1)); }

terms_file=${PUBLICATION_TERMS:-$HOME/.config/opencode/sensitive-terms.local}
terms=$( { [ -f "$terms_file" ] && cat "$terms_file"; [ -f scripts/private-ids.local ] && cat scripts/private-ids.local; } 2>/dev/null \
    | sed 's/#.*//' | sed 's/^[[:space:]]*//; s/[[:space:]]*$//' | grep -v '^$' | sort -u )
terms_re=
[ -n "$terms" ] && terms_re=$(printf '%s\n' "$terms" | paste -sd'|')

# Generic patterns: personal home paths, private keys, common token shapes.
generic='(/home/[[:alnum:]_.-]+|BEGIN (OPENSSH|RSA|EC|PGP) PRIVATE KEY|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16})'
email_re='[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
# Placeholders and identifiers that are intentionally public in these repos.
# `example.com` and the `.example` TLD are reserved for documentation (RFC 2606),
# so those addresses are synthetic by definition.
ok_patterns='@example\.(com|org|net)|\.example\b|@joseteo\.github\.com|/home/user/|127\.0\.0\.1|0\.0\.0\.0'

echo "== 1. working tree: secrets, tokens and personal paths =="
hits=$(git grep -n -I -E "$generic" -- . 2>/dev/null | grep -vE "$ok_patterns" || true)
if [ -n "$hits" ]; then printf '%s\n' "$hits"; flag; else echo "  none"; fi

echo "== 2. working tree: emails and IP addresses (review section) =="
hits=$(git grep -n -I -E "$email_re" -- . 2>/dev/null | grep -vE "$ok_patterns" || true)
if [ -n "$hits" ]; then printf '%s\n' "$hits"; flag; else echo "  no unexpected emails"; fi
hits=$(git grep -n -I -E '\b([0-9]{1,3}\.){3}[0-9]{1,3}\b' -- . 2>/dev/null | grep -vE "$ok_patterns" || true)
if [ -n "$hits" ]; then printf '%s\n' "$hits"; flag; else echo "  no unexpected addresses"; fi

echo "== 3. working tree: private terms =="
if [ -n "$terms_re" ]; then
    hits=$(git grep -n -I -i -E "$terms_re" -- . 2>/dev/null | sort -u || true)
    if [ -n "$hits" ]; then printf '%s\n' "$hits"; flag; else echo "  none"; fi
else
    echo "  (no terms files found; create $terms_file)"
fi

echo "== 4. full history: private terms =="
if [ -n "$terms_re" ]; then
    hits=$(git rev-list --all | xargs -r git grep -n -I -i -E "$terms_re" 2>/dev/null | sort -u || true)
    if [ -n "$hits" ]; then printf '%s\n' "$hits"; flag; else echo "  none"; fi
fi

echo "== 5. full history: secrets, tokens and personal paths =="
hits=$(git rev-list --all | xargs -r git grep -n -I -E "$generic" 2>/dev/null | grep -vE "$ok_patterns" | sort -u || true)
if [ -n "$hits" ]; then printf '%s\n' "$hits"; flag; else echo "  none"; fi

echo "== 6. commit messages =="
hits=$(git log --all --format='%h %s%n%b' | grep -i -E "${terms_re:+$terms_re|}$generic" || true)
if [ -n "$hits" ]; then printf '%s\n' "$hits"; flag; else echo "  none"; fi

echo "== 7. docs voice check (review only) =="
git grep -n -i -E '\bthe owner|\bmy (server|vps|homelab|lab|infrastructure)\b' -- '*.md' 2>/dev/null || echo "  clear"

echo "== 8. artifact =="
if [ -n "$zip" ]; then
    if [ -f scripts/verify-package.py ]; then
        python3 scripts/verify-package.py "$zip" || flag
    else
        echo "  no verifier in this repository; inspect $zip manually (unzip -l plus a term scan)"; flag
    fi
else
    echo "  (no --zip given)"
fi

echo
if [ "$findings" -eq 0 ]; then
    echo "PASS: no confidential-data findings"
else
    echo "FAIL: $findings finding(s) need attention before publishing"
    exit 1
fi
