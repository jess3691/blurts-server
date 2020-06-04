"use strict";

const crypto = require("crypto");
const uuidv4 = require("uuid/v4");
const mozlog = require("../log");
const log = mozlog("controllers.utils");

const AppConstants = require("../app-constants");


function generatePageToken(req) {
  const pageToken = {ip: req.ip, date: new Date(), nonce: uuidv4()};
  const cipher = crypto.createCipher("aes-256-cbc", AppConstants.COOKIE_SECRET);
  const encryptedPageToken = [cipher.update(JSON.stringify(pageToken), "utf8", "base64"), cipher.final("base64")].join("");
  return encryptedPageToken;

  /* TODO: block on scans-per-ip instead of scans-per-timespan
  if (req.session.scans === undefined){
    console.log("session scans undefined");
    req.session.scans = [];
  }
  req.session.numScans = req.session.scans.length;
  */
}

function hasUserSignedUpForRelay(user) {
  if (!user.waitlists_joined) {
    return false;
  }
  if (user.waitlists_joined.hasOwnProperty("email_relay")) {
    return true;
  }
  return false;
}

function getExperimentBranch(req, sorterNum = false, language = false) {

  const session = req.session.experimentFlags;

  if (sorterNum === false) {
    sorterNum = Math.floor(Math.random() * 100);
    log.debug("No coinflip number provided. Coinflip number is ", sorterNum);
  }

  if (session.excludeFromExperiment && !req.query.experimentBranch) {
    log.debug("This session has already been excluded from the experiment");
    session.excludeFromExperiment = true;
    return false;
  }

  // If we cannot parse req.headers["accept-language"], we should not
  // enroll users in the experiment.
  if (language && !req.headers || language && !req.headers["accept-language"]){
    log.debug("No headers or accept-language information present.");
    session.excludeFromExperiment = true;
    return false;
  }

  // If the user doesn't have the requested variant langauge selected as their primary language,
  // we do not enroll them in the experiment.
  if (language) {
    const lang = req.headers["accept-language"].split(",");
    if (language && !lang[0].includes(language)) {
      log.debug(`Preferred language is not ${language} variant: ${lang[0]}`);
      session.excludeFromExperiment = true;
      return false;
    }
  }

  // If URL param has experimentBranch entry, use that branch;
  if (req.query.experimentBranch) {
    if (!["va", "vb"].includes(req.query.experimentBranch)) {
      log.debug("The requested branch is unknown: ", req.query.experimentBranch);
      session.excludeFromExperiment = true;
      return false;
    }
    log.debug("This session has been set to the requested branch: ", req.query.experimentBranch);
    session.excludeFromExperiment = false;
    session.experimentBranch = req.query.experimentBranch;
    return req.query.experimentBranch;
  }

  // If user was already assigned a branch, stay in that branch;
  if (session.experimentBranch) {
    log.debug("This session has already been assigned: ", session.experimentBranch);
    return session.experimentBranch;
  }

  // Growth Team Experiment 2 only wants to expose 29/29/42 of all site traffic to
  // the experiment. Of the 58% percent inside the experiment, will be split
  // 50/50 between treatment and control.
  if (sorterNum < 29) {
    log.debug("This session has been randomly assigned to the control group. (va)");
    session.experimentBranch = "va";
    return "va";
  } else if (sorterNum > 28 && sorterNum < 58) {
    log.debug("This session has been randomly assigned to the treatment group. (vb)");
    session.experimentBranch = "vb";
    return "vb";
  }
  log.debug("This session has randomly been removed from the experiment");
  session.excludeFromExperiment = true;
  return false;
}

function getExperimentFlags(req, EXPERIMENTS_ENABLED) {
  if (!req) {
    throw new Error("No request availabe");
  }

  if (req.session.experimentFlags && EXPERIMENTS_ENABLED) {
    return req.session.experimentFlags;
  }

  const experimentFlags = {
    experimentBranch: false,
    isUserInExperiment: false,
    experimentBranchB: false,
    excludeFromExperiment: false,
  };

  return experimentFlags;
}


module.exports = {
  generatePageToken,
  hasUserSignedUpForRelay,
  getExperimentBranch,
  getExperimentFlags,
};
