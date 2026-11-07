"""Shared supplier list for the demo PDFs and the seed script."""

from datetime import date, timedelta

TODAY = date.today()


def _months_ago(months: int) -> date:
    month = TODAY.month - months
    year = TODAY.year
    while month <= 0:
        month += 12
        year -= 1
    return date(year, month, min(TODAY.day, 28))


ALPHA_CERT_EXPIRED = _months_ago(2).isoformat()
BETA_CERT_EXPIRES = (TODAY + timedelta(days=30)).isoformat()
GAMMA_CERT_EXPIRES = (TODAY + timedelta(days=400)).isoformat()

SUPPLIERS = [
    {
        "name": "Alpha Präzisionsteile GmbH",
        "country": "DE",
        "category": "Precision parts",
        "criticality": "high",
        "is_synthetic": True,
        "files": {
            "alpha-annual-financial-report.pdf": [
                "Alpha Präzisionsteile GmbH annual financial report.",
                "Fiscal year end: 2025-12-31.",
                "Revenue: 15000000 EUR.",
                "Revenue previous year: 20000000 EUR.",
                "Net income: -1800000 EUR.",
                "Equity ratio: 8.0 %.",
            ],
            "alpha-iso-9001-certificate.pdf": [
                "Alpha Präzisionsteile GmbH certification.",
                "Standard: ISO 9001.",
                f"Expires on: {ALPHA_CERT_EXPIRED}.",
            ],
            "alpha-delivery-performance.pdf": [
                "Alpha Präzisionsteile GmbH delivery performance report.",
                "On-time delivery rate: 78.0 %.",
            ],
        },
    },
    {
        "name": "Beta Kunststofftechnik GmbH",
        "country": "DE",
        "category": "Plastics",
        "criticality": "medium",
        "is_synthetic": True,
        "files": {
            "beta-annual-financial-report.pdf": [
                "Beta Kunststofftechnik GmbH annual financial report.",
                "Fiscal year end: 2025-12-31.",
                "Revenue: 9000000 EUR.",
                "Revenue previous year: 10000000 EUR.",
                "Net income: 120000 EUR.",
                "Current ratio: 1.2.",
            ],
            "beta-iso-9001-certificate.pdf": [
                "Beta Kunststofftechnik GmbH certification.",
                "Standard: ISO 9001.",
                f"Expires on: {BETA_CERT_EXPIRES}.",
            ],
            "beta-delivery-performance.pdf": [
                "Beta Kunststofftechnik GmbH delivery performance report.",
                "On-time delivery rate: 91.0 %.",
            ],
        },
    },
    {
        "name": "Gamma Elektronik AG",
        "country": "CH",
        "category": "Electronics",
        "criticality": "medium",
        "is_synthetic": True,
        "files": {
            "gamma-annual-financial-report.pdf": [
                "Gamma Elektronik AG annual financial report.",
                "Fiscal year end: 2025-12-31.",
                "Revenue: 10800000 EUR.",
                "Revenue previous year: 10000000 EUR.",
                "Net income: 2400000 EUR.",
                "Equity ratio: 42.0 %.",
                "Current ratio: 2.4.",
            ],
            "gamma-iso-iatf-certificate.pdf": [
                "Gamma Elektronik AG certification.",
                "Standard: ISO 9001.",
                f"Expires on: {GAMMA_CERT_EXPIRES}.",
                "Standard: IATF 16949.",
                f"Expires on: {GAMMA_CERT_EXPIRES}.",
            ],
            "gamma-delivery-quality.pdf": [
                "Gamma Elektronik AG delivery and quality report.",
                "On-time delivery rate: 98.0 %.",
                "Defect rate: 120 ppm.",
            ],
        },
    },
    {
        "name": "Delta Logistik GmbH",
        "country": "DE",
        "category": "Logistics",
        "criticality": "medium",
        "is_synthetic": True,
        "files": {
            "delta-supply-contract.pdf": [
                "Delta Logistik GmbH supply contract.",
                "Contract end: 2027-12-31.",
                "Single source: yes.",
                "This supplier is the single source for the contracted logistics services.",
            ],
        },
    },
]
