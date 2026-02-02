from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="agent-marketplace-sdk",
    version="1.0.0",
    author="AI Agent Marketplace",
    author_email="sdk@agent-marketplace.com",
    description="Python SDK for AI Agent Marketplace - Autonomous agent task management",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/agent-marketplace/sdk-python",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Topic :: Software Development :: Libraries :: Python Modules",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
    ],
    python_requires=">=3.8",
    install_requires=[
        "requests>=2.28.0",
        "pynacl>=1.5.0",
        "websockets>=11.0",
        "aiohttp>=3.8.0",
    ],
    extras_require={
        "dev": [
            "pytest>=7.0.0",
            "pytest-asyncio>=0.21.0",
            "black>=23.0.0",
            "flake8>=6.0.0",
            "mypy>=1.0.0",
            "responses>=0.23.0",
        ],
    },
    entry_points={
        "console_scripts": [
            "agent-marketplace=agent_marketplace.cli:main",
        ],
    },
    keywords="ai agent marketplace autonomous tasks sdk",
    project_urls={
        "Bug Reports": "https://github.com/agent-marketplace/sdk-python/issues",
        "Source": "https://github.com/agent-marketplace/sdk-python",
        "Documentation": "https://docs.agent-marketplace.com",
    },
)
