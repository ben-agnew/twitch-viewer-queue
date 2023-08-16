# Twitch Viewer Queue

A simple viewer queue to allow chatters to join and get picked in order or at random by a mod.

Picking can be done one at a time if no number is selected or in groups by passing an amount to pick.


# Installation

- Ensure docker is installed
- Rename "docker-compose EXAMPLE.yml" to "docker-compose.yml"
- Add the relevant environment values within this file. [To generate the token for a user you can use this site](https://twitchapps.com/tmi/). [To find the ID of the Twitch channel you can use this site](https://www.streamweasels.com/tools/convert-twitch-username-to-user-id/)

- To build and run the container run the following
```bash
docker compose up -d
```

# Commands

## Contents

- [Join Channel](#joinchannel) - Join the channel of the user sending the message
- [Leave Channel](#leavechannel) - Leave the channel of the user sending the message
- [Queue Info](#queue) - Return the current information about the queue in the channel.
- [Join The Queue](#join) - Return the current information about the queue in the channel.
- [Leave The Queue](#leave) - Leave the queue for the current channel.
- [Open The Queue](#open) - Open the queue for the current channel.
- [Close The Queue](#close) - Close the queue for the current channel.
- [Clear The Queue](#close) - Remove all users from the queue for the current channel.
- [Queue Length](#length) - Return the number of users in the queue for the current channel.
- [Queue Level](#level) - Return or set the user level for the queue for the current channel.
- [Queue List](#list) - Return all the users in the queue for the current channel.
- [Queue Limit](#limit) - Set the max users allowed in the queue for the current channel.
- [Pick User/'s](#limit) - Pick one or more users from the queue for the current channel.
- [Random Pick User/'s](#rand) - Pick one or more random users from the queue for the current channel.
- [Remove User](#remove) - Remove a user from the queue for the current channel..

## Joinchannel

To get the bot to join your channel.

~~~ 
!joinchannel
~~~

## Leavechannel

To get the bot to leave your channel.

~~~ 
!leavechannel
~~~

## Queue

Return the current information about the queue in the channel.

~~~ 
!queue
~~~

## Join

Join the queue for the current channel.

~~~ 
!join
~~~

*If the user does not have permission to join the queue they will receive a response stating so.*

## Leave

Leave the queue for the current channel.

~~~ 
!leave
~~~

## Open

Open the queue for the current channel.
~~~ 
!open
~~~
*User must be moderator or broadcaster to use this command*
## Close

Close the queue for the current channel.
~~~ 
!close
~~~
*User must be moderator or broadcaster to use this command*
## Clear

Remove all users from the queue for the current channel.
~~~ 
!clear
~~~
*User must be moderator or broadcaster to use this command*
## Length

Return the number of users in the queue for the current channel.

~~~ 
!length
~~~
## Level

Return or set the user level for the queue for the current channel.

**Parameters:**

*Moderator use only*

``userLevel``: 
- Viewer (v,viewer,0)
- Subscriber (s,subscriber,1)
- VIP (vip,2)
- Moderator(m,moderator,3)


~~~ 
!level (userLevel)
~~~
## List

Return all the users in the queue for the current channel. (*Limited to 500 characters*)

~~~ 
!list
~~~

## Limit

Set the max users allowed in the queue for the current channel.

**Parameters:**


``userLimit``: Number (*0 for no limit*)


~~~ 
!limit (userLimit)
~~~
*User must be moderator or broadcaster to use this command*

## Pick

Pick one or more users from the queue for the current channel.

**Parameters:**


``pickAmount``: Number (*If not given only one will be used*)


~~~ 
!pick (pickAmount)
~~~
*User must be moderator or broadcaster to use this command*

## Rand

Pick one or more random users from the queue for the current channel.

**Parameters:**


``pickAmount``: Number (*If not given only one will be used*)


~~~ 
!rand (pickAmount)
~~~
*User must be moderator or broadcaster to use this command*

## Remove

Remove a user from the queue for the current channel.

**Parameters:**


``userName``: *Must be the users display name*


~~~ 
!remove (userName)
~~~
*User must be moderator or broadcaster to use this command*



## Contributing

Pull requests are welcome. For major changes, please open an issue first
to discuss what you would like to change.
