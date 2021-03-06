# Kidizen Science API

## Project Overview

I completed this project as part of CS 467 (Online Capstone Project) during Fall 2020 while I was a student at Oregon State University. **Students in that class were granted express permission to post source code of the final project publicly unless otherwise forbidden by a non-disclosure agreement entered into with a sponsoring organization; since this project was sponsored directly by the course instructor, no such non-disclosure agreement applies to this project.**

This repository contains the public API I created as part of a larger project entitled "Kidizen Science." The purpose of the "Kidizen Science" project is to allow students in grades K-8 to participate in [Citizen Science](https://en.wikipedia.org/wiki/Citizen_science) projects. The project includes a mobile app for teachers to create projects and students to record observations for those projects as well as this public REST API hosted on Google Cloud Platform with which the mobile app interacts for CRUD functionality in Google Cloud Datastore. My 2 teammates were responsible for creating the mobile app, and I was responsible for creating the API. Our team began this project from scratch with the intent (as indicated by the sponsor) that the project eventually be Open Source and also include a frontend website. The API is publicly accessible so that, in the spirit of Open Source, other developers could make their own frontend implementations that interact with the API. **This repository only includes the source code for the API that I myself created and made publicly available and _not_ the source code for the frontend mobile app to respect the privacy of my teammates until such time as they decide to make the frontend code publicly available. Additionally, this repository is _not_ Open Source and is simply publicly available for demonstration purposes as part of my online portfolio.**

## Repository Structure

The source code for this repository is divided into two main folders:
- api: Contains all source code for the public REST API hosted on Google Cloud Platform as well as [the API's README.md file](api/README.md).
- testing: Contains source code for a Postman test suite, including JSON files for the test collection and environment as well as a subfolder of image files for testing purposes.