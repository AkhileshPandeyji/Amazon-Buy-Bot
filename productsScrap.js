let puppeteer = require("puppeteer");
let fs = require("fs");

let cFile = process.argv[2];
let sText = process.argv[3];

let hitRate = 2;
let minPagesToShow = 8;
let noOfItemstoAdd = 3;

let products = [];



(async function(){
    try{
        let browser = await puppeteer.launch({
            headless:false,
            defaultViewport:null,
            executablePath:"C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
            args:["--start-maximized"]
        })
        
        let pages = await browser.pages();
        let page = pages[0];    
        
        await Promise.all([page.goto("https://www.amazon.com/"),page.waitForNavigation({waitUntil:"networkidle0"})])


        await loginAccount(page);

        await page.type("input#twotabsearchtextbox",sText,{delay:100});
        await Promise.all([page.keyboard.press("Enter"),page.waitForNavigation({waitUntil:"networkidle0"})]);
    
        let hit = 0;
        let pgNo = 1;
        
        while(pgNo<minPagesToShow){
            hit = 0;
            await page.waitForSelector("ul.a-pagination");
            let pageElements = await page.$$("div[data-uuid][data-index]");

            // console.log(pageElements.length);

            for(let i=1;i<pageElements.length;i++){
                let pAnchorElement = await pageElements[i].$(" .sg-row .sg-row h2 a");
                await page.evaluate(function(el){
                    el.focus();
                },pAnchorElement)

                await page.waitFor(200);

                let pHref = await page.evaluate(function(el){
                    return el.getAttribute("href");
                },pAnchorElement);

                let pPrice = null;

                try{
                    let pPriceElement = await pageElements[i].$(" .sg-row .sg-row span.a-price .a-offscreen");
                    if(pPriceElement!=null){
                       pPrice = await page.evaluate(function(el){
                            let dollarSep = el.textContent.trim().split("$")[1];
                            let finalString = dollarSep.split(",").join("");
                            return Number(finalString);
                        },pPriceElement)
                    }
                    else{
                        pPrice=null;
                    }
                }
                catch(err){
                    console.log("No Price");
                }

                let pName = await page.evaluate(function(el){
                    return el.textContent.trim();
                },pAnchorElement);

                if(pName.toLowerCase().includes(sText)){
                    // console.log(`${pName}:${pPrice}:${pHref}`);   
                    let pObj = {};
                    pObj["Name"] = pName;
                    pObj["Price"] = pPrice; 
                    pObj["Url"] = "https://www.amazon.com"+pHref;
                    if(pObj["Price"] != null)
                        products.push(pObj);
                    hit+=1;
                }        
            }

            // console.log(hit);

            if(hit < hitRate)
                break;
        
            let pageNavigation = await page.$$("ul.a-pagination li")
            let nextBtn = pageNavigation[pageNavigation.length - 1]
            let className = await page.evaluate(function(el){
                return el.getAttribute("class");
            },nextBtn);
                
            if(className.includes("a-disabled"))
                break;

            await Promise.all([nextBtn.click(),page.waitForNavigation({waitUntil:"networkidle0"})]);
            pgNo+=1;
        }    

        let sortedProducts = products.sort(function(a,b){
            if(a["Price"] < b["Price"])
                return -1;
            else if(a["Price"] > b["Price"])
                return 1;
            else
                return 0;
        });


        let jsonString = JSON.stringify(sortedProducts);
        await fs.promises.writeFile("products.json",jsonString);

        await addToCart(page);
        
    }
    catch(err){
        console.log(err);
        return;
    }
})();

async function addToCart(page){
    let jsonString = await fs.promises.readFile("products.json");
    let productsArr = JSON.parse(jsonString);

    for(let i=0;i<noOfItemstoAdd;i++){
        await Promise.all([page.goto(productsArr[i]["Url"]),page.waitForNavigation({waitUntil:"networkidle0"})]);
        await Promise.all([page.click("#add-to-cart-button"),page.waitForNavigation({waitUntil:"networkidle0"})]);
    }
    await Promise.all([page.click("#nav-cart"),page.waitForNavigation({waitUntil:"networkidle0"})]);
}

async function loginAccount(page){
    await Promise.all([page.click("#nav-link-accountList"),page.waitForNavigation({waitUntil:"networkidle0"})]);
    let {email,password} = require("./"+cFile);
    await page.type("input[type=email]",email,{delay:200});
    await Promise.all([page.click("input#continue"),page.waitForNavigation({waitUntil:"networkidle0"})]);
    await page.type("input[type=password]",password,{delay:200});
    await Promise.all([page.click("input#signInSubmit"),page.waitForNavigation({waitUntil:"networkidle0"})]);    
}