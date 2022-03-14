import 'dotenv/config';
import fetch from 'node-fetch';
import { ethers } from "ethers";
import _ from 'lodash';
import Twitter from 'twitter-lite';

const twitterClient = new Twitter({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token_key: process.env.TWITTER_ACCESS_KEY,
  access_token_secret: process.env.TWITTER_ACCESS_SECRET,
});

// Upload image of item retrieved from OpenSea & then tweet that image + provided text
async function tweet(tweetText: string) {
    await twitterClient.post('statuses/update', {status: tweetText});
}

async function formatAndSendTweet(sale: { asset: { name: any; permalink: any; description: any; }; winner_account: { address: any; }; total_price: any; payment_token: { symbol: any; }; }, usd: string) {
  const tokenName = sale.asset.name;
  const buyer = sale.winner_account?.address;
  const openseaLink = sale.asset.permalink;
  const description = sale.asset.description;
  const totalPrice = sale.total_price;
  const tokenSymbol = sale.payment_token.symbol;

  const formattedTokenPrice = ethers.utils.formatEther(totalPrice.toString());
  const formattedPriceSymbol = (
      (tokenSymbol === 'WETH' || tokenSymbol === 'ETH') 
          ? 'Ξ' 
          : ` ${tokenSymbol}`
  );

  const tweetText = `${tokenName} sold to ${buyer.substring(0, 8)} for ${formattedTokenPrice}${formattedPriceSymbol} or $${usd}. ${description.split('.')[0]}. ${openseaLink}`;
  console.log("Tweeting: " + tweetText);

  await tweet(tweetText)
    .then(results => {
      console.log("results", results);
    })
    .catch(console.error);
}

async function main() {
  const seconds = process.env.SECONDS ? parseInt(process.env.SECONDS) : 3_600;
  const hoursAgo = (Math.round(new Date().getTime() / 1000) - (seconds)); // in the last hour, run hourly?
  const settings = { 
    method: "GET",
    headers: {
      "X-API-KEY": process.env.OPEN_SEA_API_KEY,
    }
  };

  const openSeaResponse = await fetch(
    "https://api.opensea.io/api/v1/events?" + new URLSearchParams({
      event_type: 'successful',
      only_opensea: 'false',
      collection_slug: process.env.COLLECTION_SLUG!
  }), settings).then((resp) => resp.json());

  await Promise.all(
    openSeaResponse?.asset_events?.reverse().map(async (sale: any) => {
      var dateA = new Date(sale.created_date);
      var dateB = new Date(Date.now());
      dateB.setHours(dateB.getHours() - 1);
      dateB.setMinutes(0);
      dateB.setSeconds(0);

      if(dateA > dateB)
      {
        const formattedTokenPrice = ethers.utils.formatEther(sale.total_price.toString());
        const usd = (Number(formattedTokenPrice) * sale.payment_token.usd_price).toFixed(2);
        return formatAndSendTweet(sale, usd);
      }
    })
  );   
}

main()
  .then((res) =>{ 
    console.warn(res)
    process.exit(0)
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
