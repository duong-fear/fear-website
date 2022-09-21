const api = {
    requestJson: function (config) {
        var headers = wallet.signature === null ? {} :
        {
            signature: wallet.signature.signature,
            message: wallet.signature.message,
            address: wallet.signature.address
        };

        if (config.headers){
            $.extend(headers, config.headers);
        }
        
        $.ajax({
            type: config.method,
            url: "https://api.fear.io/api/" + config.resource,
            data: config.data ?? {},
            headers: headers,
            success: async function(response){
                await config.onSuccess(response);
            },
            error: (xhr) => {
                if(typeof config.onError === "function") config.onError(xhr);
            },
            dataType: "json"
        });
    },
    getPlayerStats: function(chainId, onSuccess) {
        this.requestJson({
            method: "get",
            resource: "ps",
            onSuccess: onSuccess,
            headers: {
                chain: chainId
            }
        });
    },
    getLeaderBoard: (page = 1) => new Promise((resolve, reject) => {
        api.requestJson({
            method: "get",
            resource: "lb",
            onSuccess: resolve,
            onError: reject,
            headers: {
                p: page
            }
        });
    }),
    // validateTweetId: function(tweetId, onSuccess, onError) {
    //     this.requestJson({
    //         method: "post",
    //         resource: "saf",
    //         onSuccess: onSuccess,
    //         onError: onError,
    //         headers: {
    //             chain: blockchain.apiChainId,
    //             tid: tweetId,
    //         }
    //     });
    // },
    // getAffiliateStatus: function(onSuccess, onError) {
    //     this.requestJson({
    //         method: "get",
    //         resource: "gaf",
    //         onSuccess: onSuccess,
    //         onError: onError,
    //         headers: {
    //             chain: blockchain.apiChainId,
    //         }
    //     });
    // },
}
