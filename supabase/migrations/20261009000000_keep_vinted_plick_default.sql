-- Keep the posting workspace focused by default. Existing marketplace and
-- posting-account records remain untouched; hidden platforms can be shown
-- again from Accounts > Apps at any time.
update public.platforms
set is_active = case when slug in ('vinted', 'plick') then true else false end;
