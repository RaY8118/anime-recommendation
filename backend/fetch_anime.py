import time
import requests

API_URL = "http://localhost:8000/animes/fetch"  # Change to your correct endpoint
INTERVAL_SECONDS = 15  # Time gap between calls
START_PAGE = 1
PER_PAGE = 10  # Adjust per your API
MAX_PAGES = 9  # ✅ stop after 50 pages


def fetch_anime(page, per_page):
    try:
        response = requests.post(
            f"{API_URL}?perPage={per_page}"
        )

        if response.status_code == 201:
            data = response.json()
            print(f"✅ Page {page}: {data}")
        else:
            print(
                f"❌ Failed for page {page}: Status {response.status_code}, {response.text}")
    except Exception as e:
        print(f"⚠️ Error for page {page}: {e}")


def main():
    page = START_PAGE
    while page <= MAX_PAGES:
        fetch_anime(page, PER_PAGE)
        page += 1
        if page <= MAX_PAGES:
            time.sleep(INTERVAL_SECONDS)
    print("🎉 Finished fetching all pages.")


if __name__ == "__main__":
    main()
