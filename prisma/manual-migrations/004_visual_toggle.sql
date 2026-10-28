-- Image-or-Gradient toggle: add Post.gradient and Download.image (both nullable, additive).
ALTER TABLE `posts` ADD COLUMN `gradient` VARCHAR(40) NULL;
ALTER TABLE `downloads` ADD COLUMN `image` VARCHAR(500) NULL;
