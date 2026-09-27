# Grateful studio dashboard — how to use it

The dashboard is where you look after bookings, opening hours, prices and enquiries. Open it at **your-website-address/studio** on a computer or phone. It isn't linked from the public site, and search engines are told not to show it.

## Signing in

Enter the **studio key**. This is the long password your developer set as `ADMIN_TOKEN` when the site went live. The key is forgotten when you close the tab, so you'll enter it again next time. Don't share it. Anyone with the key can change bookings.

If you see *"The studio key has changed or is no longer valid"*, the key was changed on the server. Ask your developer for the new one.

## The numbers along the top

| | |
| --- | --- |
| **Today / Next 7 days** | confirmed appointments |
| **Awaiting payment** | clients who are paying right now. Their time is held for 20 minutes |
| **Needs attention** | someone paid after their 20 minutes ran out, and another client took the time in the meantime. Call them to choose a new time, or refund them in PayFast |
| **New enquiries** | contact-form messages you haven't dealt with yet |
| **Subscribers** | newsletter sign-ups |

## Diary

The diary shows the next seven days, starting today. Use the arrows to move a week at a time.

Each booking shows the time, the client, the service, any notes the client added, and buttons to **call**, **WhatsApp** or **email** them.

- **Reschedule** lets you pick a new date, then a time from the list. The list only shows times that are open and free. Choose **Move booking** and the client is emailed the new time.
- **Cancel booking** asks you to confirm first. The time becomes free again and the client is emailed. If they had paid, refund them in your PayFast account: cancelling here doesn't move money.

Tick **Show cancelled & lapsed** to see bookings that were cancelled or never paid for.

## Opening hours

Clients can only book inside the hours you open here.

- **Weekly pattern:** choose a start date, an end date, the days of the week and your hours. Example: Tue–Fri, 09:00–17:00, for the next month.
- **One day:** open a single date, for example a Saturday morning.

If a day already has hours that overlap, it's left alone and the dashboard tells you.

In the list, **Close** takes a block off the booking page straight away, which is handy for a holiday or a fabric-buying day. **Reopen** brings it back, and the bin icon deletes it. None of these change bookings already made: cancel or reschedule those in the Diary.

## Services & prices

For each service you can change:

- **Price (R):** leave it blank to show **"Quote required"**. Clients then book without paying and you quote after meeting. Enter a price and clients pay when they book.
- **Deposit (R):** optional. If you set one, clients choose between paying the deposit or the full price. It must be less than the price.
- **Duration:** how much of the diary one appointment takes.
- **Description:** the wording shown on the website.
- **Shown on the site:** untick it to stop a service being booked, without deleting it.

Choose **Save** on each service. The website changes immediately.

## Enquiries

Every contact-form message is also emailed to gratefulpty@gmail.com. The Enquiries list is a checklist to work through:

- Select the email address to reply from your own email.
- Choose **Mark replied** once you've answered, and **Archive** to move a message out of the way.

## If something goes wrong

Every change is checked by the server. If it can't be made, the dashboard shows the reason in plain words, for example *"That time is already booked."* If a page won't load, check your internet connection and refresh. For anything else, contact your developer. The technical notes are in `README.md`.
