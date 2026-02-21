## Prompt Ladder:
### Scaffold
### Create a web application with the following layout:
### An app title with the text "Get accessible color descriptions while shopping"
### A main content area with:
### - A text input field for pasting a product page URL
### - A submit button labeled "Analyze Colors"
### - An empty results area below for displaying the color analysis
### - A simple, clean footer
### - Use an accessible color scheme with good contrast
### Core flow
### Add the following functionality:
### - When the user pastes a product page URL and clicks submit:
### 1. Fetch the product page and extract the main product image(s)
### 2. Send the product image(s) to the Anthropic API using Claude with vision capabilities
### 3. The Claude prompt should analyze the image and:
###  - Identify the main color(s) visible in the product
###  - Describe each color clearly and accurately (e.g., "deep burgundy red with cool undertones", "warm orange-toned pink", "light clear blue")
###  - If there are multiple colors/shades, list each one separately
###  - Provide the description in a format accessible to screen readers
###  - Display Claude's color analysis in the results area
### Data + validation
### Add error handling and validation:
### - Validate that the URL field is not empty before submitting
### - Validate that the input is a proper URL format
### - If the URL cannot be accessed, show error: "We couldn't access that page. Please check the URL and try again."
### - If no product images are found on the page, show: "We couldn't find product images on this page. Please try a different URL."
### - If the image cannot be analyzed (too dark, too blurry, etc.), show: "We had trouble analyzing this image."
### - If the Claude API call fails, show: "Something went wrong. Please try again in a moment."
### - Add a loading state that shows "Analyzing product image..." while waiting for the response
### - Handle cases where pages have multiple product images, default to the main/first product image
### UX polish

### Docs + cleanup
