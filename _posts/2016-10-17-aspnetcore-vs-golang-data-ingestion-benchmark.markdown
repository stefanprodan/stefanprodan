---
title:  "ASP.NET Core vs Go data ingestion benchmark"
description: "A performance test of ASP.NET Core and golang HTTP Server and HTTP Client data ingestion flow"
date:   2016-10-17 08:00:00
categories: [Guides]
tags: [.NET Core,GoLang]
---

Two year ago I've developed a data ingestion system and I'm planning to migrate it from Windows to Linux and Docker. 

This system is composed of two types of services that are communicating over HTTP: 

* a front-end service (Web API) that receives various payloads in JSON format, validates them, does data transformation and aggregation then sends the data to the back-end service
* a back-end service (Web API) that receives data from the front-end services and based on the payload type it persists it to various storages (PG, ES, Redis, OpenStack Swift)

At peak hours the current system has an ingestion rate of 1000 payloads per second and it's using about 4GB RAM.
Before porting it to a different technology, I have to make sure that the new tech can handle this kind of load and I also want a smaller memory footprint. 
Since I enjoy writing APIs with C# and Go, I decided to code a basic data flow in both technologies and run some tests on a staging server that has similar specs with the production ones.

### Data ingestion prototype

The prototype is composed of two web apps that are running in Docker containers. 

Front-end:

* exposes a HTTP POST endpoint on which it receives a JSON payload from a caller
* on receive it deserializes the payload into an object
* serializes the object back to JSON
* instantiates an HTTP client and makes an HTTP POST request to the back-end service
* waits for the back-end service to process the payload
* disposes the HTTP client and returns a HTTP 200 Code to the caller

Back-end:

* exposes an HTTP POST endpoint on which it receives a JSON payload from the front-end service
* on receive it deserializes the payload into an object
* returns a HTTP 200 Code to the front-end service

Both services are instrumented with Prometheus. Prometheus collects the following metrics: rate of HTTP requests per second, HTTP requests latency, CPU, RAM, NET and IO usage of each container.

![data flow]({{ "assets/benchmark-system-data-flow.png" | relative_url }})

The front-end data ingestion handler in ASP.NET Core looks like this:

```cs
[HttpPost]
public IActionResult Event([FromBody]Payload payload)
{
    if (!string.IsNullOrEmpty(_settings.ProxyFor))
    {
        using (var client = new HttpClient())
        {
            client.BaseAddress = new Uri(_settings.ProxyFor);
            var content = new StringContent(JsonConvert.SerializeObject(payload), Encoding.UTF8, "application/json");
            var result = client.PostAsync("/ingest/data", content).Result;
            result.RequestMessage.Dispose();
            result.Dispose();
        }
    }

    return new EmptyResult();
}
```

And the back-end handler:

```cs
[HttpPost]
public IActionResult Data([FromBody]Payload payload)
{
    dynamic data = JsonConvert.DeserializeObject<dynamic>(payload.Data);

    return new EmptyResult();
}
```

The front-end data ingestion handler in Go:

```golang
func eventIngestHandler(w http.ResponseWriter, r *http.Request) {
    decoder := json.NewDecoder(r.Body)
    var p Payload
    err := decoder.Decode(&p)
    if err != nil {
        http.Error(w, http.StatusText(400), 400)
    }
    app, _ := r.Context().Value("app").(AppContext)
    if app.Role == "proxy" && app.Endpoints != "" {
        endpoints := strings.Split(app.Endpoints, ",")
        for _, endpoint := range endpoints {
            err := redirectPayload(p, endpoint+"/ingest/data")
            if err != nil {
                http.Error(w, http.StatusText(502), 502)
            }
        }
    }
}

func redirectPayload(p Payload, url string) error {
    b := new(bytes.Buffer)
    json.NewEncoder(b).Encode(p)
    r, err := http.Post(url, "application/json; charset=utf-8", b)
    if err != nil {
        return err
    }
    defer r.Body.Close()
    return nil
}
```

And the back-end handler in Go:

```golang
func dataIngestHandler(w http.ResponseWriter, r *http.Request) {
    decoder := json.NewDecoder(r.Body)
    var p Payload
    err := decoder.Decode(&p)
    if err != nil {
        http.Error(w, http.StatusText(400), 400)
    }
}
```

### Load testing specs

The ASP.NET Core apps are using the microsoft/dotnet latest (1.0.1) Docker image and the Go apps are using golang:1.7.1-alpine image.

Server specs:

* Ubuntu 16.04.1 LTS x64
* Docker 1.12.2
* Intel Xeon X5650 12M Cache, 2.66 GHz, 12 threads
* 12 GB RAM
* Intel 82575EB Gigabit Ethernet Controller

Load test machine specs:

* Ubuntu 16.04.1 LTS x64
* ApacheBench v2.3
* Intel Core i7-4790 8M Cache, 3.60 Ghz, 8 threads

ApacheBench command:

```
 ab -k -l -p payload.json -T application/json -c 50 -n 10000 http://<server-ip>:<app-port>/ingest/event
``` 

JSON payload:

```json
{
"data": "{'job_id':'c4bb6d130003','container_id':'ab7b85dcac72','status':'Success: process exited with code 0.'}"
}
```

### Load testing results

ApacheBench reported that the ***ASP.NET Core*** front-end service has processed ***10K*** request in ***31*** seconds at a rate of ***319*** request per second:

```
Concurrency Level:      50
Time taken for tests:   31.348 seconds
Complete requests:      10000
Failed requests:        0
Keep-Alive requests:    10000
Total transferred:      1160000 bytes
Total body sent:        2950000
HTML transferred:       0 bytes
Requests per second:    319.00 [#/sec] (mean)
Time per request:       156.741 [ms] (mean)
Time per request:       3.135 [ms] (mean, across all concurrent requests)
Transfer rate:          36.14 [Kbytes/sec] received
                        91.90 kb/s sent
                        128.04 kb/s total

Connection Times (ms)
              min  mean[+/-sd] median   max
Connect:        0    0   0.5      0      34
Processing:     8  156 175.9     98    1144
Waiting:        8  156 175.9     98    1144
Total:          8  156 175.9     98    1144
```

ApacheBench reported that the ***Go*** front-end service has processed ***10K*** request in ***3*** seconds at a rate of ***3213*** request per second:

```
Concurrency Level:      50
Time taken for tests:   3.112 seconds
Complete requests:      10000
Failed requests:        0
Keep-Alive requests:    10000
Total transferred:      1400000 bytes
Total body sent:        2950000
HTML transferred:       0 bytes
Requests per second:    3213.09 [#/sec] (mean)
Time per request:       15.561 [ms] (mean)
Time per request:       0.311 [ms] (mean, across all concurrent requests)
Transfer rate:          439.29 [Kbytes/sec] received
                        925.65 kb/s sent
                        1364.94 kb/s total

Connection Times (ms)
              min  mean[+/-sd] median   max
Connect:        0    0   0.7      0      33
Processing:     4   15  15.9     13     380
Waiting:        4   15  15.9     13     380
Total:          4   15  16.3     13     385
```

Prometheus reported the following resource usage:

```
Service	           CPU     RAM       RAM (after test)
-----------------------------------------------------
ASP.NET front-end  12.65%  224.04MB  104.74MB
ASP.NET back-end   4.23%   134.15MB  54.98MB
Go front-end       10.95%  9.13MB    4.40MB
Go back-end        3.86%   6.72MB    3.36MB
```

### Improving ASP.NET Core HTTP client code

Instead of creating a HTTP client on each call I changed the code and used a static client and switched to async:

```cs
private static HttpClient client = new HttpClient();

[HttpPost]
public async Task<IActionResult> Event([FromBody]Payload payload)
{
    if (!string.IsNullOrEmpty(_settings.ProxyFor))
    {
        var content = new StringContent(JsonConvert.SerializeObject(payload), Encoding.UTF8, "application/json");
        var result = await client.PostAsync(_settings.ProxyFor + "/ingest/data", content);
        result.RequestMessage.Dispose();
        result.Dispose();
    }
    return new EmptyResult();
}
```

The results improved a lot. ApacheBench reported that the ***ASP.NET Core*** front-end service has processed ***10K*** request in ***10*** seconds at a rate of ***936*** request per second:

```
Concurrency Level:      50
Time taken for tests:   10.674 seconds
Complete requests:      10000
Failed requests:        0
Keep-Alive requests:    10000
Total transferred:      1160000 bytes
Total body sent:        2950000
HTML transferred:       0 bytes
Requests per second:    936.87 [#/sec] (mean)
Time per request:       53.369 [ms] (mean)
Time per request:       1.067 [ms] (mean, across all concurrent requests)
Transfer rate:          106.13 [Kbytes/sec] received
                        269.90 kb/s sent
                        376.03 kb/s total

Connection Times (ms)
              min  mean[+/-sd] median   max
Connect:        0    0   0.4      0      10
Processing:     5   53  11.3     51     235
Waiting:        5   53  11.3     51     235
Total:          5   53  11.4     51     239
```

### Scale up with Docker Swarm

My goal is to make the system take 1K req/sec, so I decided to run the containers on Docker Swarm and scale the front-end service to x3.

ApacheBench reported that the ***ASP.NET Core*** front-end service ***x3*** has processed ***10K*** request in ***6*** seconds at a rate of ***1615*** request per second:

```
Concurrency Level:      100
Time taken for tests:   6.190 seconds
Complete requests:      10000
Failed requests:        0
Keep-Alive requests:    10000
Total transferred:      1160000 bytes
Total body sent:        2950000
HTML transferred:       0 bytes
Requests per second:    1615.48 [#/sec] (mean)
Time per request:       61.901 [ms] (mean)
Time per request:       0.619 [ms] (mean, across all concurrent requests)
Transfer rate:          183.00 [Kbytes/sec] received
                        465.40 kb/s sent
                        648.40 kb/s total

Connection Times (ms)
              min  mean[+/-sd] median   max
Connect:        0    0   0.5      0      16
Processing:     5   60  28.2     53     415
Waiting:        5   59  28.2     53     415
Total:          5   60  28.4     53     419
```

As expected, Docker Swarm balanced the load between the front-end instances and I could reach over 1K req/sec. The back-end service didn't need to be scaled at this load. I did a load test on the back-end service (single instance) and it got up to 4K req/sec.

For the Go app I've raised the stakes to 100K requests at a concurrency level of 100. ApacheBench reported that the ***Go*** front-end service ***x3*** has processed ***100K*** request in ***11*** seconds at a rate of ***9017*** request per second:

```
Concurrency Level:      100
Time taken for tests:   11.089 seconds
Complete requests:      100000
Failed requests:        0
Keep-Alive requests:    100000
Total transferred:      14000000 bytes
Total body sent:        29400000
HTML transferred:       0 bytes
Requests per second:    9017.95 [#/sec] (mean)
Time per request:       11.089 [ms] (mean)
Time per request:       0.111 [ms] (mean, across all concurrent requests)
Transfer rate:          1232.92 [Kbytes/sec] received
                        2589.14 kb/s sent
                        3822.06 kb/s total

Connection Times (ms)
              min  mean[+/-sd] median   max
Connect:        0    0   0.2      0      22
Processing:     4   11   7.7     10     430
Waiting:        4   11   7.7     10     430
Total:          4   11   7.8     10     435
```

### Observations

By default the ASP.NET Core garbage collector `System.GC.Server` mode is enabled, this works well on Windows but on Linux made the front-end service go up to 2GB of memory. After it reached 2GB, the HTTP client started to crash on every request. If you are deploying ASP.NET Core with Docker then you should set `"System.GC.Server": false` in project.json.

I've run this test for 6 hours every 10 minutes, while the Go performance was consistent on every run, the ASP.NET Core fluctuated a lot. I've seen ASP.NET Core jump to 20% CPU and drop to 200 req/s some times. 

When I've run the tests with 100K requests at a concurrency level of 100, both HTTP clients crashed after a while. 
In Golang I could fix this by disabling KeepAlive and setting the `MaxIdleConnsPerHost` to 100. I suppose there is a way to set the same things on ASP.NET Core too.

### Conclusions

Benchmark results:

```
     	        REQ/sec   TIME     REQ    Concurrency  Memory
-------------------------------------------------------------
ASP.NET Core    936       10sec    10K    50           224MB
Go              3213      3sec     10K    50           9MB
ASP.NET Core    1324      75sec    100K   300          235MB
Go              6051      16sec    100K   300          12MB
```

For my use case, the load tests showed that the Go HTTP stack is way faster then ASP.NET Core. Scaling the front-end service to x3 made the ASP.NET Core reach my 1K req/s goal, but the memory usage is very high compared to Go.

I know that ASP.NET Core is for all intents and purposes a brand new platform. However, running the load test on the back-end service resulted in 4K req/s which leads me to believe that, while Kestrel is very fast, there may be a bottleneck when sending HTTP requests. The .NET Core team has made some huge improvements on the Kestrel server performance this year. In terms of serving data, Kestrel has hit [1M req/sec](https://github.com/aspnet/benchmarks), so I expect the data ingestion rate to improve in the future.

If you wish to run the tests yourself, the ASP.NET Core repo is on GitHub [here](https://github.com/stefanprodan/prometheus.aspnetcore) and the Go repo [here](https://github.com/stefanprodan/gomicro).