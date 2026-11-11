PUT YOUR ART AND SOUND IN THIS FOLDER (upload to GitHub: public/assets/...)
Frames are PNG sequences named  <animation>_<number>.png   e.g. idle_01.png idle_02.png ...

monster/form1/   idle_01.png ...  happy_01.png ...  sad_01.png ...  eat_01.png ...
monster/form2/   same names (used after the 1st eat)      monster/form3/   (after 3 eats)
   Missing animation -> that form's idle. Missing form -> the previous form.
   Draw facing RIGHT, transparent background, square canvas (768x768), body filling about 80%.
   Shared art is hue-shifted per team. Own art for one team: monster/team3/form1/... (not tinted)
background/      bg_01.png bg_02.png bg_03.png ...  (looped, 4 fps by default)
music/           lobby.mp3  game.mp3  results.mp3
sfx/             correct  wrong  countdown  eatready  chomp  roundend  win   (.mp3 .ogg .wav)
Speed: optional text file fps.txt in any frame folder, one line per animation:  idle 8
Default: 12 fps (background 4). idle and background loop; happy, sad and eat play once.
