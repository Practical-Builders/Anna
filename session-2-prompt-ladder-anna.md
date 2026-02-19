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
### 
### UX polish
### Docs + cleanup
