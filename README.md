# Millifeed

The FB chatbots Millifeed and Millifeed Admin. Create channels and broadcast instantly. Let's say
you want to create a channel about pandas:

1. chat Millifeed Admin "create pandas password"
2. tell your friends to chat Millifeed "pandas" to subscribe
3. chat Millifeed Admin "send pandas" to broadcast a text/image/gif to your subscribers

Also:
If you're tired of panda pictures, just chat "pandas" to Millifeed to unsubscribe
Give the password you set in step 1 to your friends to allow them to "send pandas"

Why?
Easily broadcast notifications to a group of people without gathering their contact information. Suppose you're advertising an
event. Instead of collecting emails and sending flyers, just tell them, "hey, chat "eventname" to Millifeed for updates!"

Todo:
1. clean up the interface (add command is confusing, make it "login")
2. link to instructions video on first message
3. easily share the chat links with fb friends
4. character-limited channel descriptions
for database:
5. cull channels without any activity in >1 week -> avoid DB overflow
6. allow deleting channels
7. max # of channels per user
8. cap db collections, and backup

About:
Made by Kenny Chen, Will Glisson, Yuan Kong, and Matthew Riley for PennApps XV
