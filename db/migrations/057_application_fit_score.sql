-- T7: Success Predictor passive data collection
-- Snapshot the resume's ATS score at application time so we can later correlate
-- fit with outcomes (interview/offer rates by score band). No active prediction
-- UI yet — this just starts accruing the data.

alter table applications add column if not exists fit_score int;
comment on column applications.fit_score is
  'ATS score of the linked resume at application time. Null when no resume linked or score unavailable.';
