import re


def clean_html(raw_html: str) -> str:
    if not raw_html:
        return ""

    clean_r = re.compile('<.*?>')
    clean_text = re.sub(clean_r, '', raw_html)
    return clean_text
