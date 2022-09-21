const api = {
    requestJson: function (config) {
        $.ajax({
            type: config.method,
            url: "https://api.fear.io/api/" + config.resource,
            data: config.data ?? {},
            headers: config.headers,
            success: async function(response){
                await config.onSuccess(response);
            },
            dataType: "json"
        });
    },
    getFearPrice: function(onSuccess) {
        this.requestJson({
            onSuccess: onSuccess,
            resource: "cp",
            method: "get"
        });
    },
    getOracleData: function(onSuccess){
        this.requestJson({
            onSuccess: onSuccess,
            resource: "or",
            headers: {
                "mid": 1
            },
            method: "get"
        });
    }
}