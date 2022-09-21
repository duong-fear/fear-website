const api = {
    requestJson: function (config) {
        var headers = {
            signature: wallet.signatureData.signature,
            message: wallet.signatureData.message,
            address: wallet.signatureData.address
        };

        if (config.headers){
            $.extend(headers, config.headers);
        }
        
        $.ajax({
            type: config.method,
            url: "https://api.fearnft.games/api/" + config.resource,
            data: config.data ?? {},
            headers: headers,
            success: async function(response){
                await config.onSuccess(response);
            },
            dataType: "json"
        });
    },
    getRemainingAttempts: function(onSuccess, mid) {
        this.requestJson({
            onSuccess: onSuccess,
            resource: "rat",
            headers: { mid: mid },
            method: "get"
        });
    },
    getStats: function(onSuccess) {
        $.ajax({
            type: "get",
            url: "https://api.fearnft.games/api/stats",
            success: async function(response){
                await onSuccess(response);
            },
            dataType: "json"
        });
    },
    getPlayersWithRemainingAttempts: function(onSuccess){
        this.requestJson({
            onSuccess: onSuccess,
            resource: "ac",
            headers: { c: 1, chain: 2 },
            method: "post"
        });
    }
}