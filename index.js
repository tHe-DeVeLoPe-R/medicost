const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');


const app = express();
app.use(express.json());
app.use(cors());
const port = 5000;

app.listen(port, (req, res) => {
    console.log('app running on port 5000');
});

// First Scrape: Get name, price, discount, and link
async function scrapeDawaaiSearch(medicine) {
    try {
        const url = `https://dawaai.pk/search/index?search=${medicine}`;
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);

        const name = $('h2.header a').first().text().trim();
        const discount = $('.reduce-price.label-discount').first().text().trim() || 'No Discount';
        const link = $('h2.header a').first().attr('href');
        const completeLink = link ? `${link}` : 'No Link';

        return { name, discount, link: completeLink };
    } catch (error) {
        console.error('Error fetching search data:', error);
        return null;
    }
}

// Second Scrape: Use Puppeteer to get strip size and total price from product detail page
async function scrapeProductDetail(link) {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.goto(link, { waitUntil: 'networkidle2', timeout: 60000 });

        const data = await page.evaluate(() => {
            const stripSizeElement = document.querySelector('.inventory-detail p:nth-child(2)');
            const stripSize = stripSizeElement ? stripSizeElement.innerText.trim() : 'No strip size available';

            const totalPriceElement = document.querySelector('.total-price .product_price');
            const totalPrice = totalPriceElement ? totalPriceElement.innerText.trim() : 'No total price available';

            return { stripSize, totalPrice };
        });

        await browser.close();
        return data;
    } catch (error) {
        console.error('Error scraping product detail:', error);
        await browser.close();
        return null;
    }
}

// POST endpoint to combine both scrapes and return data
app.post('/scrape', async (req, res) => {
    // Extract the medicine name from the POST request body
    const { medicine } = req.body;

    // Validate that a medicine name was provided
    if (!medicine) {
        return res.status(400).json({ error: 'Please provide a medicine name in the request body.' });
    }

    // First scrape: Search page for name, price, discount, and link
    const medicineData = await scrapeDawaaiSearch(medicine);
    
    if (medicineData && medicineData.link) {
        // Second scrape: Product detail page for strip size and total price
        const detailData = await scrapeProductDetail(medicineData.link);

        if (detailData) {
            const combinedData = {
                ...medicineData,
                stripSize: detailData.stripSize,
                totalPrice: detailData.totalPrice
            };

            res.json(combinedData);  // Send combined data as response
        } else {
            res.status(500).json({ error: 'Error fetching product details' });
        }
    } else {
        res.status(500).json({ error: 'Error fetching search data or missing product link' });
    }
});


