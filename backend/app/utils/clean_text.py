import re


def clean_html(text: str) -> str:
    text = re.sub(r'<br\s*/?>', ' ', text)
    text = re.sub(r'<.*?>', '', text)
    return text.strip()
