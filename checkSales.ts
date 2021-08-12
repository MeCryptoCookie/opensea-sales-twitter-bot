import 'dotenv/config';
import fetch from 'node-fetch';
import { ethers } from "ethers";
import _ from 'lodash';
import Twit from 'twit';

const twitterConfig = {
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token: process.env.TWITTER_ACCESS_KEY,
  access_token_secret: process.env.TWITTER_ACCESS_SECRET,
};

const twitterClient = new Twit(twitterConfig);

// Upload image of item retrieved from OpenSea & then tweet that image + provided text
function tweet(tweetText) {
  twitterClient.post('statuses/update', {status: `${tweetText}`},  function(error, tweet, response) {
    if(error) throw error;
    console.log(tweet);  // Tweet body.
    console.log(response);  // Raw response object.
  });
}

function formatAndSendTweet(sale, usd) {
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

  console.log(encodeURIComponent(tweetText));
  tweet(encodeURIComponent(tweetText));
}

async function main() {
  const seconds = process.env.SECONDS ? parseInt(process.env.SECONDS) : 3_600;
  const hoursAgo = (Math.round(new Date().getTime() / 1000) - (seconds)); // in the last hour, run hourly?
  
  const openSeaResponse = await fetch(
    "https://api.opensea.io/api/v1/events?" + new URLSearchParams({
      offset: '0',
      limit: '100',
      event_type: 'successful',
      only_opensea: 'false',
      occurred_after: hoursAgo.toString(), 
      collection_slug: process.env.COLLECTION_SLUG!,
      contract_address: process.env.CONTRACT_ADDRESS!
  })).then((resp) => resp.json());

  await Promise.all(
    openSeaResponse?.asset_events?.reverse().map(async (sale: any) => {
      const formattedTokenPrice = ethers.utils.formatEther(sale.total_price.toString());
      const usd = (Number(formattedTokenPrice) * sale.payment_token.usd_price).toFixed(2);
      return formatAndSendTweet(sale, usd);
    })
  );   
}

main()
  .then(() =>{
    process.exit(0)
  })
  .catch(error => {
    console.log("Error " + error);
    process.exit(1);
  });
