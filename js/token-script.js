const tokenomics = [
    [' - 2,112,500 - Seed Round', 3.25, '#240d0d'],
    ['- 11,375,000 - Private Round', 17.5, '#3c0100'],
    ['- 9,750,000 - Liquidity', 15, '#810806'],
    ['- 15,762,500 - Ecosystem Incentives', 24.25, '#a00b09'],
    ['- 13,000,000 - Team', 20, '#be100d'],
    ['- 3,250,000 - Partners & Advisors', 5, '#e4221e'],
    ['- 9,750,000 - Marketing', 15, '#ff4c49']
];
const columns = tokenomics.map(_ => [
    `${_[1].toFixed(2).padStart(5, ' ')}% ${_[0]}`, // U+2003 from https://emptycharacter.com/, for spacing purpose xD
    _[1],
]);
const colors = tokenomics.map(_ => [
    `${_[1].toFixed(2).padStart(5, ' ')}% ${_[0]}`, // U+2003 from https://emptycharacter.com/, for spacing purpose xD
    _[2],
]);
var chart = c3.generate({
    data: {
        order: null,
        columns,
        colors: Object.fromEntries(colors),
        type: 'pie',
        labels: false,
    },
    pie: {
        label: {
            show: false,
        }
    },
    legend: {
        position: 'right',
        item: {
            onclick: () => {},
        }
    },
    tooltip: {
        format: {
            name: function (name, ratio, id, index) { return name.split("%")[1]; }
        }
    }
});

var tokenReleaseChart = c3.generate({
    bindto: '#token-release-chart',
    data: {
        columns: [
            ['Private', 2275000, 2275000, 2275000, 2881666, 3488332, 4094998, 4701664, 5308330, 5914996, 6521662, 7128328, 7734994, 8341660, 8948326, 9554992, 10161658, 10768324, 11375000,11375000,11375000,11375000,11375000,11375000,11375000,11375000,11375000],
            ['Seed', 422500, 422500, 422500, 535166, 647832, 760498, 873164, 985830, 1098496, 1211162, 1323828, 1436494, 1549160, 1661826, 1774492, 1887158, 1999824, 2122500,2122500,2122500,2122500,2122500,2122500,2122500,2122500,2122500],
            ['Liquidity', 243750, 487500, 731250, 975000, 1218750, 1462500, 1706250, 1950000, 2383333, 2816666, 3249999, 3683332, 4116665, 4549998, 4983331, 5416664, 5849997, 6283330 ,6716663, 7149996,7583329,8016662,8449995,8883328,9316661,9750000],
            ['Ecosystem Incentives', 394062, 788124, 1182186, 1576248, 1970310, 2364372, 2758434, 3152496,3853051,4553606,5254161,5954716,6655271,7355826,8056381,8756936,9457491,10158046,10858601,11559156,12259711,12960266,13660821,14361376,15061931,15762500],
            ['Team', 0,0,0,0,0,0,0,0,0,0,0,0,928571, 1857142, 2785713, 3714284, 4642855, 5571426, 6499997, 7428568, 8357139, 9285710, 10214281, 11142852, 12071423, 13000000],
            ['Partners & Advisors', 0,0,0,0,0,0,0,0,0,0,0,0,232142,464284,696426,928568,1160710,1392852,1624994,1857136,2089278,2321420,2553562,2785704,3017846,3250000],
            ['Marketing', 162500, 325000, 487500, 650000, 812500, 975000, 1137500, 1300000, 1462500, 1625000, 1787500, 1950000, 2489285, 3028570, 3567855,4107140,4646425,5185710,5724995,6264280,6803565,7342850,7882135,8421420,8960705,9500000]
        ],
        types: {
            Private: 'area',
            Seed: 'area',
            Liquidity: 'area',
            'Ecosystem Incentives': 'area',
            Team: 'area',
            'Partners & Advisors': 'area',
            Marketing: 'area'
        },
        groups: [['Private', 'Seed', 'Liquidity', 'Ecosystem Incentives', 'Team','Partners & Advisors','Marketing']]
    },
    axis: {
        x: {
            type: 'category',
            categories: ['06/21', '07/21', '08/21', '09/21', '10/21', '11/21','12/21','01/22','02/22','03/21','04/22','05/22','06/22','07/22','08/22','09/22','10/22','11/22','11/22','12/22','01/23','02/23','03/23','04/23','05/23','06/23','07/23']
        }
    }
});

const circSupplyUrl = "https://api.fear.io/api/circulatingsupply";
const priceUrl = "https://api.fear.io/api/cp";
var circSupply = 0;
var price = 0;

var fetched = false;

function calcMc(){
    $("#market-cap").text("$" + (circSupply * price).toFixed(0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","));
}

$.get(circSupplyUrl, function(data, status) {
    circSupply = data;
    $("#circ-supply").text(data.toFixed(0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","));

    if (fetched){
        calcMc();
    }

    fetched = true;
});

$.get(priceUrl, function(data, status) {
    price = data;
    $("#price").text("$" + data.toFixed(5));
    
    if (fetched){
        calcMc();
    }

    fetched = true;
});

function handleCopy(e, address){
    navigator.clipboard.writeText(address);
    $(".copy-address").attr("src", "images/copy-svgrepo-com.svg");
    $(e.target).attr("src", "images/circle-tick-svgrepo-com.svg");
}

$("#eth-address-copy").click(function(e){ handleCopy(e, "0x88a9a52f944315d5b4e917b9689e65445c401e83"); });    
$("#polygon-address-copy").click(function(e){ handleCopy(e, "0xa2CA40DBe72028D3Ac78B5250a8CB8c404e7Fb8C"); });
$("#bsc-address-copy").click(function(e){ handleCopy(e, "0x9ba6a67a6f3b21705a46b380a1b97373a33da311"); });
$("#ftm-address-copy").click(function(e){ handleCopy(e, "0x14418C22165553251B002b289F8AbE4D1Ed41d76"); });