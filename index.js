const express = require('express')
const { PrismaClient } = require('@prisma/client')
const axios = require('axios');
const parseString = require('xml2js').parseString;
const fs = require('fs');
const { raw, response } = require('express');

// const NC_API_KEY = '86eb8dd19891409991a421def2f365b3'
// const NC_USERNAME = 'reachnames'
// const NC_BASE  = 'api.sandbox.namecheap.com'

const NC_API_KEY = '046dee541118428aa24984519c11b359'
const NC_USERNAME = 'reachreserved2'
const NC_BASE  = 'api.namecheap.com'

let responseTime = {}

let PROMISE_COUNT = 0

const axiosClient = axios.create({
  baseURL: `https://${NC_BASE}/`,
  timeout: 100
});

axiosClient.interceptors.request.use(function (config) {
  PROMISE_COUNT++
  config.metadata = { startTime: new Date()}
  return config;
}, function (error) {
  return Promise.reject(error);
});

axiosClient.interceptors.response.use(function (response) {

  PROMISE_COUNT = Math.max(0 , PROMISE_COUNT - 1)
 
  response.config.metadata.endTime = new Date()
  response.duration = response.config.metadata.endTime - response.config.metadata.startTime

  responseTime = { 
                        
    startTime: response.config.metadata.startTime,
    endTime: response.config.metadata.endTime,
    duration: response.duration

  };

  let fileName = JSON.stringify(responseTime.startTime)

  responseTime = JSON.stringify(responseTime);
  fs.writeFileSync(`logs/${fileName}-${PROMISE_COUNT}.json`, responseTime);

  console.log('INTERCEPTOR:: ', responseTime)

  console.log('DATA:: ', response.data)

  return response.data;
}, function (error) {
  error.config.metadata.endTime = new Date();
  error.duration = error.config.metadata.endTime - error.config.metadata.startTime;
  return Promise.reject(error);
});

const env_ip = process.env.IP;

const prisma = new PrismaClient()
const app = express()

let domains, ncIP, maxCost, count = 0, rdapTime

let endpoints = []

app.use(express.json())

async function init() {

  await data()
  .then( response => {

    domainName = response.domain
    ncIP = response.nc_ip
    endpoints = response.endpoints
    rdap = response.rdap_time
    //maxCost = response.max_cost

    // let data = { 
                        
    //   domain_name: ,

    // };
    
    // googleResponseTime = JSON.stringify(googleResponseTime);
    // fs.writeFileSync(`time-google.json`, googleResponseTime);

    run(domainName, ncIP, endpoints, rdap);

  });

}

async function data() {

    const options = await prisma.wp_options.findMany({
        where: {
            option_name: {
                startsWith: 'options_',
            }
        }
    });

    domains = options.filter((option => option.option_name === 'options_ipv6_0_add_ipv6s_' + env_ip + '_add_domain_0_domain_name')).map((v) => {
                domain = v.option_value
                return domain;
              }).toString();

    ncIP = options.filter(n => n.option_name === 'options_namecheap_ipv4_address').map((v) => {
              let ncIP = v.option_value
              return ncIP;
            }).toString();

    maxCost = options.filter((option => option.option_name === 'options_ipv6_0_add_ipv6s_' + env_ip + '_add_domain_0_max_cost')).map((r) => {
        return r.option_value;
    });

    const ENDPOINT = `xml.response?ApiUser=${NC_USERNAME}&ApiKey=${NC_API_KEY}&UserName=${NC_USERNAME}&Command=namecheap.domains.create&ClientIp=${ncIP}&DomainName=${domain}&Years=1&AuxBillingFirstName=Charlie&AuxBillingLastName=Coe&AuxBillingAddress1=7%20The%20Close%20,%20Muswell%20Avenue&AuxBillingStateProvince=London&AuxBillingPostalCode=N102ED&AuxBillingCountry=UK&AuxBillingPhone=+44.2084447848&AuxBillingEmailAddress=charlie@reachnames.com&AuxBillingOrganizationName=Dot31&AuxBillingCity=London&TechFirstName=Charlie&TechLastName=Coe&TechAddress1=7%20The%20Close%20,%20Muswell%20Avenue&TechStateProvince=London&TechPostalCode=N102ED&TechCountry=UK&TechPhone=+44.2084447848&TechEmailAddress=charlie@reachnames.com&TechOrganizationName=Dot31&TechCity=London&AdminFirstName=Charlie&AdminLastName=Coe&AdminAddress1=7%20The%20Close%20,%20Muswell%20Avenue&AdminStateProvince=London&AdminPostalCode=N102ED&AdminCountry=UK&AdminPhone=+44.2084447848&AdminEmailAddress=charlie@reachnames.com&AdminOrganizationName=Dot31&AdminCity=London&RegistrantFirstName=Charlie&RegistrantLastName=Coe&RegistrantAddress1=7%20The%20Close%20,%20Muswell%20Avenue&RegistrantStateProvince=London&RegistrantPostalCode=N102ED&RegistrantCountry=UK&RegistrantPhone=+44.2084447848&RegistrantEmailAddress=charlie@reachnames.com&RegistrantOrganizationName=Dot31&RegistrantCity=London&WithheldforPrivacy=yes&WGEnabled=no&GenerateAdminOrderRefId=False`

    for( var i = 0; i < 1; i++) {
      endpoints.push(ENDPOINT)
    }

    let rdap = await axios.get(`https://www.registry.google/rdap/domain/${domain}`)
        .then( function (rdapData) {

          console.log(rdapData.data.events)

          rdapEvents = rdapData.data.events
          rdapDomainStatus = rdapData.data.status
          console.log(rdapDomainStatus)
          if(rdapDomainStatus[0] === 'pending delete' || rdapDomainStatus[1] === 'pending delete') {
            rdapEvents.map( (v) => {
              switch(v.eventAction) {
                case 'last changed':
                  rdapTime = v.eventDate
                  rdapTime = Date.parse(rdapTime)
                  rdapTime += 1000 * 60 * 60 * 24 * 5;
                  break;
              }
            });
          }

        })
        .catch( function (rdapError) {

          console.log('rdap ERROR: ', rdapError)

        })

        console.log(rdapTime)

    let data = {
      domain: domain,
      nc_ip: ncIP,
      endpoints: endpoints,
      rdap_time: rdapTime
    }

    return data

}



async function run(domain, ncIP, endpoints, rdapTime) {

  //console.log(endpoints)

  let date = Date.now()

  if(! isNaN(rdapTime)) {
    rdapOffset = rdapTime - 600
  }
  else {
    rdapOffset = date - 1
  }

  console.log('Loop running:: ', date);

  setTimeout(function() {

    if(count < 1 && rdapOffset <= date) {

      console.log('Time run start:: ', date);
      console.log('RDAP Time:: ', rdapTime);

      register(endpoints)

      count++

    } else {

      run(domain, ncIP, endpoints, rdapTime)

    }

  }, 1);

}

async function register(endpoints) {

  Promise.all(endpoints.map((endpoint) => axiosClient.get(endpoint, {timeout: 25000}))).then(response => {

    axios.spread((response) => {
      //console.log('SPREAD', response);
    })

  }).catch( error => {
    console.log('AXIOS ERROR:: ', error)
  });

}

init();