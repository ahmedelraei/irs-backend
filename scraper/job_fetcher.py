from linkedin_scraper import JobSearch, actions
from selenium import webdriver


def fetch_jobs(keywords, location="United States", limit=5):
    driver = webdriver.Chrome()
    email = "ahmedelrai18@hotmail.com"
    password = "Ahmed@2003"

    actions.login(driver, email, password)
    print("Logged in")
    job_search = JobSearch(driver=driver, close_on_complete=False, scrape=False)
    job_listings = job_search.search("Software Engineer")
    job_data = []
    for job in job_listings:
        job_data.append({
            "title": job.title,
            "company": job.company,
            "location": job.location,
            "description": job.description
        })

    return job_data