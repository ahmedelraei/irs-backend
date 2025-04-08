from job_fetcher import fetch_jobs
from rabbitmq_consumer import consume_keywords
from rabbitmq_publisher import publish_jobs

def process_keywords(keywords):
    print(f"Received keywords: {keywords}")
    jobs = fetch_jobs(",".join(keywords))
    print(f"Fetched {len(jobs)} jobs.")
    publish_jobs(jobs)

if __name__ == "__main__":
    consume_keywords(process_keywords)